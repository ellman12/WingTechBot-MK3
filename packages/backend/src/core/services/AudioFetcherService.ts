import type { AudioFormatInfo } from "@core/entities/AudioFormatInfo.js";
import type { AudioStreamWithMetadata } from "@core/entities/AudioStream.js";
import { createAudioStreamWithFormat } from "@core/entities/AudioStream.js";
import { AudioFetchTimeoutError, AudioNotFoundError, AudioSizeLimitError } from "@core/errors/AudioErrors.js";
import type { SoundRepository } from "@core/ports/repositories/SoundRepository.js";
import type { FileManager } from "@core/ports/services/FileManager.js";
import type { YoutubeService } from "@core/ports/services/YoutubeService.js";
import { readStreamToBytes } from "@core/utils/streamUtils.js";
import { Readable } from "stream";

import type { AudioCacheService } from "./AudioCacheService.js";
import type { AudioFormatDetectionService } from "./AudioFormatDetectionService.js";

export type audioSource = "soundboard" | "youtube" | "url";

export type AudioFetcherService = {
    readonly fetchUrlAudio: (link: string, abortSignal?: AbortSignal) => Promise<AudioStreamWithMetadata>;
    readonly fetchSoundboardAudio: (name: string) => Promise<AudioStreamWithMetadata>;
};

export type AudioFetcherDeps = {
    readonly youtubeService: YoutubeService;
    readonly soundRepository: SoundRepository;
    readonly fileManager: FileManager;
    readonly cacheService: AudioCacheService;
    readonly formatDetectionService?: AudioFormatDetectionService;
};

// How long we wait for response *headers*. Body progress is governed by IDLE_TIMEOUT_MS below.
const HEADERS_TIMEOUT_MS = 30_000;

// Max gap between two body chunks. An inactivity timeout, not a wall-clock one: a large file
// over a slow link is legitimate and must not be killed, whereas a server that stops sending
// must not be able to hold the request open forever.
const IDLE_TIMEOUT_MS = 30_000;

// Hard ceiling on how many bytes of a remote response we are willing to buffer in memory.
// Anything bigger is refused rather than allowed to OOM the bot.
const MAX_AUDIO_BYTES = 256 * 1024 * 1024;

// The only three things a file extension can honestly tell us about an audio stream.
type ExtensionFormatHint = Pick<AudioFormatInfo, "format" | "container" | "codec">;

const FORMAT_HINT_BY_EXTENSION: Record<string, ExtensionFormatHint> = {
    mp3: { format: "mp3", container: "mp3", codec: "mp3" },
    m4a: { format: "m4a", container: "m4a", codec: "aac" },
    opus: { format: "ogg", container: "ogg", codec: "opus" },
    ogg: { format: "ogg", container: "ogg", codec: "vorbis" },
    wav: { format: "wav", container: "wav", codec: "pcm_s16le" },
};

// AudioFormatInfo requires sampleRate/channels/bitrate, but a URL extension reveals none of
// them - only ffprobe (AudioFormatDetectionService) can. They are filled with this sentinel
// rather than a plausible-looking guess: 0 means "unknown", never "detected as 0".
// Downstream (FfmpegAudioProcessingService) reads only format/container/codec.
const UNKNOWN_NUMERIC_FIELD = 0;

const toFormatInfo = (hint: ExtensionFormatHint): AudioFormatInfo => ({
    ...hint,
    sampleRate: UNKNOWN_NUMERIC_FIELD,
    channels: UNKNOWN_NUMERIC_FIELD,
    bitrate: UNKNOWN_NUMERIC_FIELD,
});

// Extension of the URL's *path*, ignoring query and fragment. Discord CDN links always carry
// `?ex=..&is=..&hm=..` params full of dots, so splitting the raw string on "." is never right.
export const getUrlExtension = (link: string): string | undefined => {
    let pathname: string;
    try {
        pathname = new URL(link).pathname;
    } catch {
        // Not a parseable URL - refuse to guess.
        return undefined;
    }

    const lastSegment = pathname.split("/").pop() ?? "";
    const dotIndex = lastSegment.lastIndexOf(".");
    if (dotIndex <= 0 || dotIndex === lastSegment.length - 1) {
        return undefined;
    }

    return lastSegment.slice(dotIndex + 1).toLowerCase();
};

// Lets a caller give up on a download without cancelling it for everyone else sharing it
// (see singleFlight). The underlying fetch keeps its own 30s timeout regardless.
const withAbort = <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => {
    if (!signal) return promise;

    return new Promise<T>((resolve, reject) => {
        const abort = () => {
            const error = new Error("Fetch aborted by caller");
            error.name = "AbortError";
            reject(error);
        };

        if (signal.aborted) {
            abort();
            return;
        }

        signal.addEventListener("abort", abort, { once: true });
        promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    });
};

const detectFormatFromUrl = (link: string): AudioFormatInfo | undefined => {
    const extension = getUrlExtension(link);
    const hint = extension ? FORMAT_HINT_BY_EXTENSION[extension] : undefined;
    return hint ? toFormatInfo(hint) : undefined;
};

export const createAudioFetcherService = ({ fileManager, soundRepository, youtubeService, cacheService, formatDetectionService }: AudioFetcherDeps) => {
    // Concurrent requests for the same URL share one download. The shared value is the
    // completed bytes rather than a stream, because a Readable can only be consumed once -
    // every caller gets its own fresh Readable over the same buffer.
    type DownloadResult = {
        readonly bytes: Uint8Array;
        readonly formatInfo?: AudioFormatInfo;
    };

    const inFlightDownloads = new Map<string, Promise<DownloadResult>>();

    const singleFlight = (key: string, download: () => Promise<DownloadResult>): Promise<DownloadResult> => {
        const existing = inFlightDownloads.get(key);
        if (existing) {
            console.log(`[AudioFetcherService] Joining in-flight download for: ${key}`);
            return existing;
        }

        const pending = download().finally(() => {
            inFlightDownloads.delete(key);
        });

        inFlightDownloads.set(key, pending);
        return pending;
    };

    const toAudioStream = ({ bytes, formatInfo }: DownloadResult): AudioStreamWithMetadata => {
        return formatInfo ? createAudioStreamWithFormat(Readable.from(bytes), formatInfo) : { stream: Readable.from(bytes) };
    };

    const fetchYoutubeAudio = async (link: string): Promise<AudioStreamWithMetadata> => {
        try {
            const cached = await cacheService.getCached(link);
            if (cached) {
                console.log(`[AudioFetcherService] Cache hit for YouTube: ${link}`);
                return cached;
            }

            const result = await singleFlight(link, async () => {
                const audioWithMetadata = await youtubeService.fetchAudioFromYoutube(link);
                if (!audioWithMetadata || !audioWithMetadata.stream) {
                    const error = new AudioNotFoundError(`Failed to fetch audio from YouTube: ${link}`, { url: link });
                    console.error(`[AudioFetcherService] ${error.message}`);
                    throw error;
                }

                const audioBytes = await readStreamToBytes(audioWithMetadata.stream, { limitBytes: MAX_AUDIO_BYTES, sourceName: link, idleTimeoutMs: IDLE_TIMEOUT_MS });

                cacheService.saveToCache(link, audioBytes, audioWithMetadata.formatInfo).catch(err => {
                    console.error(`[AudioFetcherService] Failed to cache audio:`, err);
                });

                return { bytes: audioBytes, formatInfo: audioWithMetadata.formatInfo };
            });

            return toAudioStream(result);
        } catch (error) {
            console.error(`[AudioFetcherService] Error fetching YouTube audio:`, error);
            throw error;
        }
    };

    const downloadUrl = async (link: string): Promise<DownloadResult> => {
        const timeoutController = new AbortController();
        const timeout = setTimeout(() => {
            timeoutController.abort();
        }, HEADERS_TIMEOUT_MS);

        try {
            const response = await fetch(link, {
                signal: timeoutController.signal,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                },
            });

            if (!response.ok || response.body == null) {
                const message = `Failed to fetch audio from URL: ${link} (Status: ${response.status})`;
                console.error(`[AudioFetcherService] ${message}`);
                if (response.status === 404 || response.status === 410) {
                    throw new AudioNotFoundError(message, { url: link });
                }
                throw new Error(message);
            }

            // Reject oversized bodies before reading a single byte when the server declares a length.
            const declaredLength = Number(response.headers.get("content-length"));
            if (Number.isFinite(declaredLength) && declaredLength > MAX_AUDIO_BYTES) {
                throw new AudioSizeLimitError(`Audio exceeds the ${Math.round(MAX_AUDIO_BYTES / 1024 / 1024)}MB size limit: ${link}`, {
                    sizeBytes: declaredLength,
                    limitBytes: MAX_AUDIO_BYTES,
                });
            }

            const formatInfo = detectFormatFromUrl(link);

            // Headers arrived, so the headers deadline has done its job. From here the body is
            // policed by an inactivity timeout instead, which tolerates a slow but progressing
            // download while still cutting off a server that stalls mid-stream.
            clearTimeout(timeout);

            const audioStream = Readable.fromWeb(response.body);
            const audioBytes = await readStreamToBytes(audioStream, { limitBytes: MAX_AUDIO_BYTES, sourceName: link, idleTimeoutMs: IDLE_TIMEOUT_MS });

            cacheService.saveToCache(link, audioBytes, formatInfo).catch(err => {
                console.error(`[AudioFetcherService] Failed to cache audio:`, err);
            });

            return { bytes: audioBytes, formatInfo };
        } finally {
            clearTimeout(timeout);
        }
    };

    const fetchUrlAudio = async (link: string, abortSignal?: AbortSignal): Promise<AudioStreamWithMetadata> => {
        if (parseAudioSource(link) === "youtube") {
            return fetchYoutubeAudio(link);
        }

        try {
            const cached = await cacheService.getCached(link);
            if (cached) {
                console.log(`[AudioFetcherService] Cache hit for URL: ${link}`);
                return cached;
            }

            const result = await withAbort(
                singleFlight(link, () => downloadUrl(link)),
                abortSignal
            );
            return toAudioStream(result);
        } catch (error) {
            console.error(`[AudioFetcherService] Error fetching URL audio:`, error);

            if (error instanceof Error) {
                if (error.name === "AbortError" || error.name === "TimeoutError") {
                    throw new AudioFetchTimeoutError(`Request timeout or cancelled while fetching: ${link}`, { url: link, timeoutMs: IDLE_TIMEOUT_MS }, { cause: error });
                }
                if (error.message.includes("ETIMEDOUT")) {
                    throw new AudioFetchTimeoutError(`Connection timeout while fetching: ${link}`, { url: link, timeoutMs: IDLE_TIMEOUT_MS }, { cause: error });
                }
                if (error.message.includes("ENOTFOUND")) {
                    throw new AudioNotFoundError(`Host not found: ${link}`, { url: link }, { cause: error });
                }
            }

            throw error;
        }
    };

    const fetchSoundboardAudio = async (name: string): Promise<AudioStreamWithMetadata> => {
        try {
            const sound = await soundRepository.getSoundByName(name);

            if (!sound) {
                const error = new AudioNotFoundError(`Sound not found: ${name}`);
                console.error(`[AudioFetcherService] ${error.message}`);
                throw error;
            }

            const filePath = sound.path;

            const fileExists = await fileManager.fileExists(filePath);
            if (!fileExists) {
                const error = new AudioNotFoundError(`Sound file does not exist: ${filePath}`, { filePath });
                console.error(`[AudioFetcherService] ${error.message}`);
                throw error;
            }

            if (formatDetectionService) {
                try {
                    const formatInfo = await formatDetectionService.detectFromFile(filePath);
                    const stream = fileManager.readStream(filePath);
                    return createAudioStreamWithFormat(stream, formatInfo);
                } catch (error) {
                    console.error(`[AudioFetcherService] Format detection failed for ${filePath}, falling back to assumed PCM:`, error);
                }
            }

            const stream = fileManager.readStream(filePath);

            const formatInfo: AudioFormatInfo = {
                format: "s16le",
                container: "s16le",
                codec: "pcm_s16le",
                sampleRate: 48000,
                channels: 2,
                bitrate: 0,
            };

            return createAudioStreamWithFormat(stream, formatInfo);
        } catch (error) {
            console.error(`[AudioFetcherService] Error fetching soundboard audio:`, error);
            throw error;
        }
    };

    return {
        fetchUrlAudio,
        fetchSoundboardAudio,
    };
};

export const parseAudioSource = (source: string): audioSource => {
    const normalized = source.trim().toLowerCase();

    if (normalized.startsWith("http")) {
        if (normalized.includes("youtube.com/") || normalized.includes("youtu.be/")) {
            return "youtube";
        }

        return "url";
    }

    return "soundboard";
};
