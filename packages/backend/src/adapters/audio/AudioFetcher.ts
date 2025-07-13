import { createAudioResource } from "@discordjs/voice";
import { createReadStream } from "fs";

import { type ExtendedAudioResource, createFFmpegAudioResource } from "./FFmpegAudioAdapter.js";

export type AudioSource = {
    type: "local-file" | "remote-url" | "youtube-url" | "text-to-speech" | "audio-blob";
    source: string;
    options?: AudioFetcherOptions;
};

export type AudioFetcherOptions = {
    sampleRate?: number;
    channels?: number;
    bitrate?: string;
    format?: string;
    codec?: string;
    // Text-to-speech specific options
    voice?: string;
    speed?: number;
    // YouTube specific options
    quality?: "lowest" | "low" | "medium" | "high" | "highest";
};

export class AudioFetcher {
    /**
     * Fetches audio from various sources and returns an AudioResource
     */
    static async fetchAudio(source: AudioSource): Promise<ExtendedAudioResource> {
        console.log(`[AUDIO FETCHER] Fetching audio from source: ${source.type} - ${source.source}`);

        switch (source.type) {
            case "local-file":
                return await this.fetchLocalFile(source.source, source.options);

            case "remote-url":
                return await this.fetchRemoteUrl(source.source, source.options);

            case "youtube-url":
                return await this.fetchYouTubeUrl(source.source, source.options);

            case "text-to-speech":
                return this.fetchTextToSpeech(source.source, source.options);

            case "audio-blob":
                return this.fetchAudioBlob(source.source, source.options);

            default:
                throw new Error(`Unsupported audio source type: ${(source as AudioSource).type}`);
        }
    }

    /**
     * Fetches audio from a local file
     */
    private static async fetchLocalFile(filePath: string, options?: AudioFetcherOptions): Promise<ExtendedAudioResource> {
        console.log(`[AUDIO FETCHER] Fetching local file: ${filePath}`);

        // For local MP3 files, use createReadStream directly
        if (filePath.endsWith(".mp3")) {
            const stream = createReadStream(filePath);
            const resource = createAudioResource(stream, {
                inlineVolume: true,
            });
            return resource as ExtendedAudioResource;
        }

        // For other local files, use FFmpeg for format conversion
        return await createFFmpegAudioResource(`file://${filePath}`, options);
    }

    /**
     * Fetches audio from a remote URL
     */
    private static async fetchRemoteUrl(url: string, options?: AudioFetcherOptions): Promise<ExtendedAudioResource> {
        console.log(`[AUDIO FETCHER] Fetching remote URL: ${url}`);
        try {
            return await createFFmpegAudioResource(url, options);
        } catch (error) {
            console.error(`[AUDIO FETCHER] Failed to fetch remote URL: ${url}`, error);
            throw new Error(`Failed to fetch audio from remote URL: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Fetches audio from a YouTube URL
     */
    private static async fetchYouTubeUrl(url: string, _options?: AudioFetcherOptions): Promise<ExtendedAudioResource> {
        console.log(`[AUDIO FETCHER] Fetching YouTube URL: ${url}`);

        // TODO: Implement YouTube DL integration
        // For now, treat as remote URL
        return await this.fetchRemoteUrl(url, _options);
    }

    /**
     * Fetches audio from text-to-speech
     */
    private static fetchTextToSpeech(text: string, _options?: AudioFetcherOptions): ExtendedAudioResource {
        console.log(`[AUDIO FETCHER] Converting text to speech: ${text.substring(0, 50)}...`);

        // TODO: Implement text-to-speech integration
        // For now, throw error
        throw new Error("Text-to-speech not yet implemented");
    }

    /**
     * Fetches audio from an audio blob (base64, buffer, etc.)
     */
    private static fetchAudioBlob(_blob: string, _options?: AudioFetcherOptions): ExtendedAudioResource {
        console.log(`[AUDIO FETCHER] Processing audio blob`);

        // TODO: Implement audio blob processing
        // For now, throw error
        throw new Error("Audio blob processing not yet implemented");
    }

    /**
     * Determines the audio source type from a string input
     */
    static detectSourceType(input: string): AudioSource["type"] {
        if (input.startsWith("http://") || input.startsWith("https://")) {
            // Check if it's a YouTube URL
            if (input.includes("youtube.com") || input.includes("youtu.be")) {
                return "youtube-url";
            }
            return "remote-url";
        }

        // Check if it's a local file
        if (input.includes(".") && !input.startsWith("http")) {
            return "local-file";
        }

        // Default to remote URL (could be a URL without protocol)
        return "remote-url";
    }

    /**
     * Creates an AudioSource from a string input with auto-detection
     */
    static createAudioSource(input: string, options?: AudioFetcherOptions): AudioSource {
        const type = this.detectSourceType(input);
        return {
            type,
            source: input,
            options,
        };
    }
}
