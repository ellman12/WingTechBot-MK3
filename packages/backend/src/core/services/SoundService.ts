import type { SoundRepository } from "@core/repositories/SoundRepository.js";
import { createRepeatedPcmStream } from "@core/utils/audio/pcmRepeater.js";
import { createPreBufferedStream, readStreamToBytes } from "@core/utils/streamUtils.js";
import { Readable } from "stream";

import { type AudioFetcherService, parseAudioSource } from "./AudioFetcherService.js";
import type { AudioProcessingService } from "./AudioProcessingService.js";
import type { FileManager } from "./FileManager.js";

export type SoundService = {
    readonly addSound: (name: string, source: string) => Promise<void>;
    readonly getSound: (nameOrSource: string, abortSignal?: AbortSignal) => Promise<Readable>;
    readonly getRepeatedSound: (nameOrSource: string, delaysMs: number[], abortSignal?: AbortSignal) => Promise<string>;
    readonly listSounds: (tagName?: string) => Promise<string[]>;
    readonly deleteSound: (name: string) => Promise<void>;
};

export type SoundServiceDeps = {
    readonly audioFetcher: AudioFetcherService;
    readonly audioProcessor: AudioProcessingService;
    readonly fileManager: FileManager;
    readonly soundRepository: SoundRepository;
};

const AUDIO_FILE_STORE_PATH = "./sounds";

export const createSoundService = ({ audioFetcher, audioProcessor, fileManager, soundRepository }: SoundServiceDeps): SoundService => {
    console.log("[SoundService] Creating sound service");

    // Cache for temporary repeated sounds
    const repeatedSoundCache = new Map<string, Readable>();

    const getSoundInternal = async (nameOrSource: string, abortSignal?: AbortSignal): Promise<Readable> => {
        // Check if this is a cached repeated sound
        const cachedRepeated = repeatedSoundCache.get(nameOrSource);
        if (cachedRepeated) {
            console.log(`[SoundService] Returning cached repeated sound: ${nameOrSource}`);
            repeatedSoundCache.delete(nameOrSource); // Remove after use
            return cachedRepeated;
        }
        const startTime = Date.now();
        console.log(`[SoundService] Getting sound: ${nameOrSource}`);

        try {
            const sourceType = parseAudioSource(nameOrSource);
            console.log(`[SoundService] Detected source type: ${sourceType} for: ${nameOrSource}`);

            switch (sourceType) {
                case "soundboard": {
                    console.log(`[SoundService] Fetching soundboard audio: ${nameOrSource}`);
                    const sound = await soundRepository.getSoundByName(nameOrSource);
                    if (!sound) {
                        const error = new Error(`Sound with name ${nameOrSource} not found`);
                        console.error(`[SoundService] ${error.message}`);
                        throw error;
                    }

                    const soundPath = `${AUDIO_FILE_STORE_PATH}${sound.path}`;
                    console.log(`[SoundService] Reading soundboard file: ${soundPath}`);

                    const stream = fileManager.readStream(soundPath);
                    const elapsedTime = Date.now() - startTime;
                    console.log(`[SoundService] Successfully created direct soundboard stream for: ${nameOrSource} in ${elapsedTime}ms`);

                    console.log(`[SoundService] Returning direct file stream to eliminate buffering overhead`);
                    return stream;
                }
                case "url":
                case "youtube": {
                    console.log(`[SoundService] Fetching and processing URL/YouTube audio: ${nameOrSource}`);
                    const audioStream = await audioFetcher.fetchUrlAudio(nameOrSource, abortSignal);
                    console.log(`[SoundService] Got audio stream, processing for: ${nameOrSource}`);

                    const processedStream = audioProcessor.processAudioStream(audioStream);
                    console.log(`[SoundService] Pre-buffering processed stream for: ${nameOrSource}`);

                    const preBufferedStream = await createPreBufferedStream(processedStream, `url:${nameOrSource}`, abortSignal);

                    const elapsedTime = Date.now() - startTime;
                    console.log(`[SoundService] Successfully pre-buffered audio stream for: ${nameOrSource} in ${elapsedTime}ms`);
                    return preBufferedStream;
                }
            }
        } catch (error) {
            console.error(`[SoundService] Error getting sound ${nameOrSource}:`, error);
            throw error;
        }
    };

    return {
        addSound: async (name: string, source: string): Promise<void> => {
            console.log(`[SoundService] Adding sound: ${name} from source: ${source}`);

            try {
                console.log(`[SoundService] Fetching audio stream for: ${source}`);
                // Create abort controller with timeout for addSound operations
                const abortController = new AbortController();
                const timeout = setTimeout(() => abortController.abort(), 60000); // 60 second timeout for downloads

                try {
                    const audioStream = await audioFetcher.fetchUrlAudio(source, abortController.signal);
                    clearTimeout(timeout);

                    console.log(`[SoundService] Reading stream to bytes for: ${name}`);
                    const audio: Uint8Array = await readStreamToBytes(audioStream.stream);
                    console.log(`[SoundService] Read ${audio.length} bytes for: ${name}`);

                    console.log(`[SoundService] Processing audio for: ${name}`);
                    const processedAudio = await audioProcessor.deepProcessAudio(audio);
                    console.log(`[SoundService] Processed audio result: ${processedAudio.length} bytes for: ${name}`);

                    const path = `/${name}.pcm`;
                    const fullPath = `${AUDIO_FILE_STORE_PATH}${path}`;

                    console.log(`[SoundService] Writing binary audio file to: ${fullPath}`);
                    // Convert Uint8Array to Readable stream for writeStream
                    const binaryAudioStream = Readable.from(processedAudio);
                    await fileManager.writeStream(fullPath, binaryAudioStream);

                    console.log(`[SoundService] Adding sound to repository: ${name} -> ${path}`);
                    await soundRepository.addSound({ name, path });

                    console.log(`[SoundService] Successfully added sound: ${name}`);
                } catch (fetchError) {
                    clearTimeout(timeout);
                    throw fetchError;
                }
            } catch (error) {
                console.error(`[SoundService] Error adding sound ${name}:`, error);
                throw error;
            }
        },
        getSound: getSoundInternal,
        getRepeatedSound: async (nameOrSource: string, delaysMs: number[], abortSignal?: AbortSignal): Promise<string> => {
            const startTime = Date.now();
            console.log(`[SoundService] Getting repeated sound: ${nameOrSource} with ${delaysMs.length} repetitions`);

            try {
                const soundStream = await getSoundInternal(nameOrSource, abortSignal);

                console.log(`[SoundService] Reading PCM data for repetition`);
                const pcmData = await readStreamToBytes(soundStream);
                console.log(`[SoundService] Read ${pcmData.length} bytes of PCM data`);

                const repeatedStream = createRepeatedPcmStream(pcmData, delaysMs);

                const tempName = `temp-repeated-${Date.now()}`;
                repeatedSoundCache.set(tempName, repeatedStream);

                const elapsedTime = Date.now() - startTime;
                console.log(`[SoundService] Successfully created repeated stream for: ${nameOrSource} in ${elapsedTime}ms, cached as: ${tempName}`);

                return tempName;
            } catch (error) {
                console.error(`[SoundService] Error getting repeated sound ${nameOrSource}:`, error);
                throw error;
            }
        },
        listSounds: async (tagName?: string): Promise<string[]> => {
            console.log(`[SoundService] Listing all sounds`);

            try {
                const sounds = tagName ? await soundRepository.getAllSoundsWithTagName(tagName) : await soundRepository.getAllSounds();
                const soundNames = sounds.map(sound => sound.name);
                console.log(`[SoundService] Found ${soundNames.length} sounds:`, soundNames);
                return soundNames;
            } catch (error) {
                console.error(`[SoundService] Error listing sounds:`, error);
                throw error;
            }
        },
        deleteSound: async (name: string): Promise<void> => {
            console.log(`[SoundService] Deleting sound: ${name}`);

            try {
                const sound = await soundRepository.getSoundByName(name);
                if (!sound) {
                    const error = new Error(`Sound with name ${name} not found`);
                    console.error(`[SoundService] ${error.message}`);
                    throw error;
                }

                const fullPath = `${AUDIO_FILE_STORE_PATH}${sound.path}`;
                console.log(`[SoundService] Deleting file: ${fullPath}`);
                await fileManager.deleteFile(fullPath);

                console.log(`[SoundService] Removing sound from repository: ${name}`);
                await soundRepository.deleteSound(sound.name);

                console.log(`[SoundService] Successfully deleted sound: ${name}`);
            } catch (error) {
                console.error(`[SoundService] Error deleting sound ${name}:`, error);
                throw error;
            }
        },
    };
};
