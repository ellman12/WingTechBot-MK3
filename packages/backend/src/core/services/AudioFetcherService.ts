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

export const createAudioFetcherService = ({ fileManager, soundRepository, youtubeService, cacheService, formatDetectionService }: AudioFetcherDeps) => {
    console.log("[AudioFetcherService] Creating audio fetcher service with caching enabled");

    const fetchYoutubeAudio = async (link: string): Promise<AudioStreamWithMetadata> => {
        console.log(`[AudioFetcherService] Fetching YouTube audio: ${link}`);

        try {
            // Check cache first
            const cached = await cacheService.getCached(link);
            if (cached) {
                console.log(`[AudioFetcherService] Returning cached YouTube audio for: ${link}`);
                return cached;
            }

            console.log(`[AudioFetcherService] Cache miss, downloading from YouTube: ${link}`);
            const audioWithMetadata = await youtubeService.fetchAudioFromYoutube(link);
            if (!audioWithMetadata || !audioWithMetadata.stream) {
                const error = new Error(`Failed to fetch audio from YouTube: ${link}`);
                console.error(`[AudioFetcherService] ${error.message}`);
                throw error;
            }

            // Read stream to bytes so we can cache it
            console.log(`[AudioFetcherService] Reading YouTube audio stream to bytes for caching`);
            const audioBytes = await readStreamToBytes(audioWithMetadata.stream);

            // Save to cache (non-blocking) with format information
            cacheService.saveToCache(link, audioBytes, audioWithMetadata.formatInfo).catch(err => {
                console.error(`[AudioFetcherService] Failed to cache audio:`, err);
            });

            console.log(`[AudioFetcherService] Successfully fetched YouTube audio for: ${link}`);
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
        console.log(`[AudioFetcherService] Fetching URL audio: ${link}`);

        if (link.startsWith("https://www.youtube.com/") || link.startsWith("https://youtu.be/")) {
            console.log(`[AudioFetcherService] Detected YouTube URL, routing to YouTube service: ${link}`);
            return fetchYoutubeAudio(link);
        }

        console.log(`[AudioFetcherService] Fetching direct URL audio: ${link}`);
        try {
            // Check cache first
            const cached = await cacheService.getCached(link);
            if (cached) {
                console.log(`[AudioFetcherService] Returning cached URL audio for: ${link}`);
                return cached;
            }

            console.log(`[AudioFetcherService] Cache miss, downloading from URL: ${link}`);

            // Create a timeout controller if no abort signal provided
            const timeoutController = new AbortController();
            const timeout = setTimeout(() => {
                timeoutController.abort();
            }, 30000); // 30 second timeout

            // Combine user abort signal with timeout
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

            let formatInfo: AudioFormatInfo | undefined;

            const urlExt = link.split(".").pop()?.split("?")[0]?.toLowerCase();
            if (urlExt === "mp3") {
                formatInfo = {
                    format: "mp3",
                    container: "mp3",
                    codec: "mp3",
                    sampleRate: 44100,
                    channels: 2,
                    bitrate: 128000,
                };
            } else if (urlExt === "m4a") {
                formatInfo = {
                    format: "m4a",
                    container: "m4a",
                    codec: "aac",
                    sampleRate: 44100,
                    channels: 2,
                    bitrate: 128000,
                };
            } else if (urlExt === "opus") {
                formatInfo = {
                    format: "opus",
                    container: "opus",
                    codec: "opus",
                    sampleRate: 48000,
                    channels: 2,
                    bitrate: 128000,
                };
            } else if (urlExt === "ogg") {
                formatInfo = {
                    format: "ogg",
                    container: "ogg",
                    codec: "vorbis",
                    sampleRate: 44100,
                    channels: 2,
                    bitrate: 128000,
                };
            } else if (urlExt === "wav") {
                formatInfo = {
                    format: "wav",
                    container: "wav",
                    codec: "pcm_s16le",
                    sampleRate: 44100,
                    channels: 2,
                    bitrate: 0,
                };
            }

            console.log(`[AudioFetcherService] Inferred format from URL:`, formatInfo);

            const audioStream = Readable.fromWeb(response.body);
            const audioBytes = await readStreamToBytes(audioStream);

            cacheService.saveToCache(link, audioBytes).catch(err => {
                console.error(`[AudioFetcherService] Failed to cache audio:`, err);
            });

            console.log(`[AudioFetcherService] Successfully fetched direct URL audio: ${link}`);

            if (formatInfo) {
                return createAudioStreamWithFormat(Readable.from(audioBytes), formatInfo);
            }

            return {
                stream: Readable.from(audioBytes),
            };
        } catch (error) {
            console.error(`[AudioFetcherService] Error fetching URL audio:`, error);

            // Provide more specific error messages
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
        console.log(`[AudioFetcherService] Fetching soundboard audio: ${name}`);

        try {
            const sound = await soundRepository.getSoundByName(name);

            if (!sound) {
                const error = new Error(`Sound not found: ${name}`);
                console.error(`[AudioFetcherService] ${error.message}`);
                throw error;
            }

            console.log(`[AudioFetcherService] Found sound in repository:`, {
                name: sound.name,
                path: sound.path,
            });

            const filePath = sound.path;

            // Check if the file exists
            const fileExists = await fileManager.fileExists(filePath);

            if (!fileExists) {
                const error = new Error(`Sound file does not exist: ${filePath}`);
                console.error(`[AudioFetcherService] ${error.message}`);
                throw error;
            }

            console.log(`[AudioFetcherService] Sound file exists, creating stream: ${filePath}`);

            // Probe the soundboard file to get accurate format info
            if (formatDetectionService) {
                console.log(`[AudioFetcherService] Probing soundboard file for format: ${filePath}`);
                try {
                    const formatInfo = await formatDetectionService.detectFromFile(filePath);
                    console.log(`[AudioFetcherService] Detected soundboard format via ffprobe:`, formatInfo);

                    const stream = fileManager.readStream(filePath);
                    return createAudioStreamWithFormat(stream, formatInfo);
                } catch (error) {
                    console.error(`[AudioFetcherService] Format detection failed for soundboard file, falling back to assumed PCM: ${error}`);
                    // Fallback to assumed PCM format
                }
            }

            const stream = fileManager.readStream(filePath);
            console.log(`[AudioFetcherService] Successfully created soundboard audio stream for: ${name} (assumed PCM format)`);

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
    console.log(`[AudioFetcherService] Parsing audio source: ${source}`);

    if (source.startsWith("http")) {
        console.log(`[AudioFetcherService] Detected URL source: ${source}`);
        return "url";
    }

    console.log(`[AudioFetcherService] Detected soundboard source: ${source}`);
    return "soundboard";
};
