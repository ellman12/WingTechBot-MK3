import type { AudioFormatInfo } from "@core/entities/AudioFormatInfo.js";
import type { AudioStreamWithMetadata } from "@core/entities/AudioStream.js";
import { createAudioStreamWithFormat } from "@core/entities/AudioStream.js";
import type { SoundRepository } from "@core/repositories/SoundRepository.js";
import { readStreamToBytes } from "@core/utils/streamUtils.js";
import { Readable } from "stream";

import type { AudioCacheService } from "./AudioCacheService.js";
import type { AudioFormatDetectionService } from "./AudioFormatDetectionService.js";
import type { FileManager } from "./FileManager.js";

export type audioSource = "soundboard" | "youtube" | "url";

export type YoutubeService = {
    readonly fetchAudioFromYoutube: (link: string) => Promise<AudioStreamWithMetadata>;
};

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

const FORMAT_BY_EXTENSION: Record<string, AudioFormatInfo> = {
    mp3: { format: "mp3", container: "mp3", codec: "mp3", sampleRate: 44100, channels: 2, bitrate: 128000 },
    m4a: { format: "m4a", container: "m4a", codec: "aac", sampleRate: 44100, channels: 2, bitrate: 128000 },
    opus: { format: "ogg", container: "ogg", codec: "opus", sampleRate: 48000, channels: 2, bitrate: 128000 },
    ogg: { format: "ogg", container: "ogg", codec: "vorbis", sampleRate: 44100, channels: 2, bitrate: 128000 },
    wav: { format: "wav", container: "wav", codec: "pcm_s16le", sampleRate: 44100, channels: 2, bitrate: 0 },
};

export const createAudioFetcherService = ({ fileManager, soundRepository, youtubeService, cacheService, formatDetectionService }: AudioFetcherDeps) => {
    const fetchYoutubeAudio = async (link: string): Promise<AudioStreamWithMetadata> => {
        try {
            const cached = await cacheService.getCached(link);
            if (cached) {
                console.log(`[AudioFetcherService] Cache hit for YouTube: ${link}`);
                return cached;
            }

            const audioWithMetadata = await youtubeService.fetchAudioFromYoutube(link);
            if (!audioWithMetadata || !audioWithMetadata.stream) {
                const error = new Error(`Failed to fetch audio from YouTube: ${link}`);
                console.error(`[AudioFetcherService] ${error.message}`);
                throw error;
            }

            const audioBytes = await readStreamToBytes(audioWithMetadata.stream);

            cacheService.saveToCache(link, audioBytes, audioWithMetadata.formatInfo).catch(err => {
                console.error(`[AudioFetcherService] Failed to cache audio:`, err);
            });

            if (audioWithMetadata.formatInfo) {
                return createAudioStreamWithFormat(Readable.from(audioBytes), audioWithMetadata.formatInfo);
            } else {
                return { stream: Readable.from(audioBytes) };
            }
        } catch (error) {
            console.error(`[AudioFetcherService] Error fetching YouTube audio:`, error);
            throw error;
        }
    };

    const fetchUrlAudio = async (link: string, abortSignal?: AbortSignal): Promise<AudioStreamWithMetadata> => {
        if (link.startsWith("https://www.youtube.com/") || link.startsWith("https://youtu.be/")) {
            return fetchYoutubeAudio(link);
        }

        try {
            const cached = await cacheService.getCached(link);
            if (cached) {
                console.log(`[AudioFetcherService] Cache hit for URL: ${link}`);
                return cached;
            }

            const timeoutController = new AbortController();
            const timeout = setTimeout(() => {
                timeoutController.abort();
            }, 30000);

            const combinedSignal = abortSignal ? AbortSignal.any([abortSignal, timeoutController.signal]) : timeoutController.signal;

            const response = await fetch(link, {
                signal: combinedSignal,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                },
            });

            clearTimeout(timeout);

            if (!response.ok || response.body == null) {
                const error = new Error(`Failed to fetch audio from URL: ${link} (Status: ${response.status})`);
                console.error(`[AudioFetcherService] ${error.message}`);
                throw error;
            }

            const urlExt = link.split(".").pop()?.split("?")[0]?.toLowerCase();
            const formatInfo: AudioFormatInfo | undefined = urlExt ? FORMAT_BY_EXTENSION[urlExt] : undefined;

            const audioStream = Readable.fromWeb(response.body);
            const audioBytes = await readStreamToBytes(audioStream);

            cacheService.saveToCache(link, audioBytes).catch(err => {
                console.error(`[AudioFetcherService] Failed to cache audio:`, err);
            });

            if (formatInfo) {
                return createAudioStreamWithFormat(Readable.from(audioBytes), formatInfo);
            }

            return { stream: Readable.from(audioBytes) };
        } catch (error) {
            console.error(`[AudioFetcherService] Error fetching URL audio:`, error);

            if (error instanceof Error) {
                if (error.name === "AbortError") {
                    throw new Error(`Request timeout or cancelled while fetching: ${link}`);
                }
                if (error.message.includes("ETIMEDOUT")) {
                    throw new Error(`Connection timeout while fetching: ${link}`);
                }
                if (error.message.includes("ENOTFOUND")) {
                    throw new Error(`Host not found: ${link}`);
                }
            }

            throw error;
        }
    };

    const fetchSoundboardAudio = async (name: string): Promise<AudioStreamWithMetadata> => {
        try {
            const sound = await soundRepository.getSoundByName(name);

            if (!sound) {
                const error = new Error(`Sound not found: ${name}`);
                console.error(`[AudioFetcherService] ${error.message}`);
                throw error;
            }

            const filePath = sound.path;

            const fileExists = await fileManager.fileExists(filePath);
            if (!fileExists) {
                const error = new Error(`Sound file does not exist: ${filePath}`);
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
    return source.startsWith("http") ? "url" : "soundboard";
};
