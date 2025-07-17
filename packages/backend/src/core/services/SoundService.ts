import type { SoundRepository } from "@core/repositories/SoundRepository";
import { createPreBufferedStream, readStreamToBytes } from "@core/utils/streamUtils";
import { Readable } from "stream";

import type { AudioFetcherService } from "./AudioFetcherService";
import type { AudioProcessingService } from "./AudioProcessingService";
import type { FileManager } from "./FileManager";

export type SoundService = {
    readonly addSound: (name: string, source: string) => Promise<void>;
    readonly getSound: (nameOrSource: string) => Promise<Readable>;
    readonly listSounds: () => Promise<string[]>;
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

    return {
        addSound: async (name: string, source: string): Promise<void> => {
            console.log(`[SoundService] Adding sound: ${name} from source: ${source}`);

            try {
                console.log(`[SoundService] Fetching audio stream for: ${source}`);
                const audioStream = await audioFetcher.fetchUrlAudio(source);

                console.log(`[SoundService] Reading stream to bytes for: ${name}`);
                const audio: Uint8Array = await readStreamToBytes(audioStream);
                console.log(`[SoundService] Read ${audio.length} bytes for: ${name}`);

                console.log(`[SoundService] Processing audio for: ${name}`);
                const processedAudio = await audioProcessor.deepProcessAudio(audio);
                console.log(`[SoundService] Processed audio result: ${processedAudio.length} bytes for: ${name}`);

                const path = `/${name}.ogg`;
                const fullPath = `${AUDIO_FILE_STORE_PATH}${path}`;

                console.log(`[SoundService] Writing binary audio file to: ${fullPath}`);
                // Convert Uint8Array to Readable stream for writeStream
                const binaryAudioStream = Readable.from(processedAudio);
                await fileManager.writeStream(fullPath, binaryAudioStream);

                console.log(`[SoundService] Adding sound to repository: ${name} -> ${path}`);
                await soundRepository.addSound({ name, path });

                console.log(`[SoundService] Successfully added sound: ${name}`);
            } catch (error) {
                console.error(`[SoundService] Error adding sound ${name}:`, error);
                throw error;
            }
        },
        getSound: async (nameOrSource: string): Promise<Readable> => {
            const startTime = Date.now();
            console.log(`[SoundService] Getting sound: ${nameOrSource}`);

            try {
                const sourceType = audioFetcher.parseAudioSource(nameOrSource);
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

                        // Try bypassing buffering for local files to eliminate potential stream processing issues
                        console.log(`[SoundService] Returning direct file stream to eliminate buffering overhead`);
                        return stream;
                    }
                    case "url":
                    case "youtube": {
                        console.log(`[SoundService] Fetching and processing URL/YouTube audio: ${nameOrSource}`);
                        const audioStream = await audioFetcher.fetchUrlAudio(nameOrSource);
                        console.log(`[SoundService] Got audio stream, processing for: ${nameOrSource}`);

                        const processedStream = audioProcessor.processAudioStream(audioStream);
                        console.log(`[SoundService] Pre-buffering processed stream for: ${nameOrSource}`);

                        // Use pre-buffering for URL/YouTube content to ensure smooth playback
                        const preBufferedStream = await createPreBufferedStream(processedStream, `url:${nameOrSource}`);

                        const elapsedTime = Date.now() - startTime;
                        console.log(`[SoundService] Successfully pre-buffered audio stream for: ${nameOrSource} in ${elapsedTime}ms`);
                        return preBufferedStream;
                    }
                }
            } catch (error) {
                console.error(`[SoundService] Error getting sound ${nameOrSource}:`, error);
                throw error;
            }
        },
        listSounds: async (): Promise<string[]> => {
            console.log(`[SoundService] Listing all sounds`);

            try {
                const sounds = await soundRepository.getAllSounds();
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
