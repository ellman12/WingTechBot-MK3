import type { SoundRepository } from "@core/repositories/SoundRepository";
import { Readable } from "stream";

import type { FileManager } from "./FileManager";

export type audioSource = "soundboard" | "youtube" | "url";

export type YoutubeService = {
    readonly fetchAudioFromYoutube: (link: string) => Promise<Readable>;
};

export type AudioFetcherService = {
    readonly parseAudioSource: (source: string) => audioSource;
    readonly fetchUrlAudio: (link: string, abortSignal?: AbortSignal) => Promise<Readable>;
    readonly fetchSoundboardAudio: (name: string) => Promise<Readable>;
};

export type AudioFetcherDeps = {
    readonly youtubeService: YoutubeService;
    readonly soundRepository: SoundRepository;
    readonly fileManager: FileManager;
};

export const createAudioFetcherService = ({ fileManager, soundRepository, youtubeService }: AudioFetcherDeps) => {
    console.log("[AudioFetcherService] Creating audio fetcher service");

    const parseAudioSource = (source: string): audioSource => {
        console.log(`[AudioFetcherService] Parsing audio source: ${source}`);

        if (source.startsWith("http")) {
            console.log(`[AudioFetcherService] Detected URL source: ${source}`);
            return "url";
        }

        console.log(`[AudioFetcherService] Detected soundboard source: ${source}`);
        return "soundboard";
    };

    const fetchYoutubeAudio = async (link: string): Promise<Readable> => {
        console.log(`[AudioFetcherService] Fetching YouTube audio: ${link}`);

        try {
            const audioStream = await youtubeService.fetchAudioFromYoutube(link);
            if (!audioStream) {
                const error = new Error(`Failed to fetch audio from YouTube: ${link}`);
                console.error(`[AudioFetcherService] ${error.message}`);
                throw error;
            }

            console.log(`[AudioFetcherService] Successfully fetched YouTube audio stream for: ${link}`);
            return audioStream;
        } catch (error) {
            console.error(`[AudioFetcherService] Error fetching YouTube audio:`, error);
            throw error;
        }
    };

    const fetchUrlAudio = async (link: string, abortSignal?: AbortSignal): Promise<Readable> => {
        console.log(`[AudioFetcherService] Fetching URL audio: ${link}`);

        if (link.startsWith("https://www.youtube.com/") || link.startsWith("https://youtu.be/")) {
            console.log(`[AudioFetcherService] Detected YouTube URL, routing to YouTube service: ${link}`);
            return fetchYoutubeAudio(link);
        }

        console.log(`[AudioFetcherService] Fetching direct URL audio: ${link}`);
        try {
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
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            clearTimeout(timeout);

            if (!response.ok || response.body == null) {
                const error = new Error(`Failed to fetch audio from URL: ${link} (Status: ${response.status})`);
                console.error(`[AudioFetcherService] ${error.message}`);
                throw error;
            }

            console.log(`[AudioFetcherService] Successfully fetched direct URL audio: ${link}`);
            return Readable.fromWeb(response.body);
        } catch (error) {
            console.error(`[AudioFetcherService] Error fetching URL audio:`, error);
            
            // Provide more specific error messages
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    throw new Error(`Request timeout or cancelled while fetching: ${link}`);
                }
                if (error.message.includes('ETIMEDOUT')) {
                    throw new Error(`Connection timeout while fetching: ${link}`);
                }
                if (error.message.includes('ENOTFOUND')) {
                    throw new Error(`Host not found: ${link}`);
                }
            }
            
            throw error;
        }
    };

    const fetchSoundboardAudio = async (name: string): Promise<Readable> => {
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
            const stream = fileManager.readStream(filePath);
            console.log(`[AudioFetcherService] Successfully created soundboard audio stream for: ${name}`);

            return stream;
        } catch (error) {
            console.error(`[AudioFetcherService] Error fetching soundboard audio:`, error);
            throw error;
        }
    };

    return {
        parseAudioSource,
        fetchUrlAudio,
        fetchSoundboardAudio,
    };
};
