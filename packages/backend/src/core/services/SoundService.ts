import type { Config } from "@core/config/Config.js";
import type { SoundRepository } from "@core/ports/repositories/SoundRepository.js";
import type { AudioProcessingService } from "@core/ports/services/AudioProcessingService.js";
import type { FileManager } from "@core/ports/services/FileManager.js";
import { createRepeatedPcmStream } from "@core/utils/audio/pcmRepeater.js";
import { createPreBufferedStream, readStreamToBytes } from "@core/utils/streamUtils.js";
import { randomUUID } from "node:crypto";
import path from "path";
import { Readable } from "stream";

import { type AudioFetcherService, parseAudioSource } from "./AudioFetcherService.js";

export type SoundService = {
    readonly addSound: (name: string, source: string) => Promise<void>;
    readonly getSound: (nameOrSource: string, abortSignal?: AbortSignal) => Promise<Readable | null>;
    readonly getRepeatedSound: (namesOrSources: string[], delaysMs: number[], abortSignal?: AbortSignal) => Promise<string | null>;
    readonly listSounds: (tagName?: string) => Promise<string[]>;
    readonly deleteSound: (name: string) => Promise<void>;
};

export type SoundServiceDeps = {
    readonly audioFetcher: AudioFetcherService;
    readonly audioProcessor: AudioProcessingService;
    readonly fileManager: FileManager;
    readonly soundRepository: SoundRepository;
    readonly config: Config;
};

// Ceiling on how much decoded audio a single sound may occupy in memory. Stored sounds are raw
// 48kHz/2ch/16-bit PCM (~11.5MB per minute), so this is roughly 20 minutes of audio.
const MAX_SOUND_BYTES = 256 * 1024 * 1024;

// Unconsumed repeated sounds are fully materialised PCM streams, so they cannot be allowed to live forever
export const REPEATED_SOUND_TTL_MS = 5 * 60 * 1000;

type CachedRepeatedSound = {
    readonly stream: Readable;
    readonly evictionTimeout: NodeJS.Timeout;
};

export const createSoundService = ({ audioFetcher, audioProcessor, fileManager, soundRepository, config }: SoundServiceDeps): SoundService => {
    const AUDIO_FILE_STORE_PATH = config.sounds.storagePath;
    const AUDIO_FILE_STORE_ROOT = path.resolve(AUDIO_FILE_STORE_PATH);

    // Cache for temporary repeated sounds
    const repeatedSoundCache = new Map<string, CachedRepeatedSound>();

    // Defence in depth: never trust a sound path, not even one that came back from the database.
    // Sound files live directly inside the sound store, so anything that resolves elsewhere is rejected.
    const resolveSoundFilePath = (soundPath: string): string => {
        const resolved = path.resolve(path.join(AUDIO_FILE_STORE_ROOT, soundPath));

        if (resolved === AUDIO_FILE_STORE_ROOT || path.dirname(resolved) !== AUDIO_FILE_STORE_ROOT) {
            throw new Error(`Invalid sound path "${soundPath}": must resolve to a file directly inside the sound storage directory`);
        }

        return resolved;
    };

    const cacheRepeatedSound = (stream: Readable): string => {
        const tempName = `temp-repeated-${randomUUID()}`;

        const evictionTimeout = setTimeout(() => {
            const stranded = repeatedSoundCache.get(tempName);
            if (!stranded) {
                return;
            }

            repeatedSoundCache.delete(tempName);
            console.warn(`[SoundService] Evicting unconsumed repeated sound ${tempName} after ${REPEATED_SOUND_TTL_MS}ms`);
            stranded.stream.destroy();
        }, REPEATED_SOUND_TTL_MS);

        // Don't keep the process alive just for an eviction timer
        evictionTimeout.unref?.();

        repeatedSoundCache.set(tempName, { stream, evictionTimeout });
        return tempName;
    };

    const getSoundInternal = async (nameOrSource: string, abortSignal?: AbortSignal): Promise<Readable | null> => {
        // Check if this is a cached repeated sound
        const cachedRepeated = repeatedSoundCache.get(nameOrSource);
        if (cachedRepeated) {
            repeatedSoundCache.delete(nameOrSource);
            clearTimeout(cachedRepeated.evictionTimeout);
            return cachedRepeated.stream;
        }

        const startTime = Date.now();
        const sourceType = parseAudioSource(nameOrSource);

        try {
            switch (sourceType) {
                case "soundboard": {
                    const sound = await soundRepository.getSoundByName(nameOrSource);
                    if (!sound) {
                        return null;
                    }

                    const soundPath = resolveSoundFilePath(sound.path);
                    return fileManager.readStream(soundPath);
                }
                case "url":
                case "youtube": {
                    const audioStream = await audioFetcher.fetchUrlAudio(nameOrSource, abortSignal);
                    const processedStream = audioProcessor.processAudioStream(audioStream);
                    const preBufferedStream = await createPreBufferedStream(processedStream, `url:${nameOrSource}`, abortSignal);

                    console.log(`[SoundService] Fetched and buffered ${nameOrSource} in ${Date.now() - startTime}ms`);
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
            try {
                // Reject a hostile name before doing any work with it
                const soundPath = `/${name}.pcm`;
                const fullPath = resolveSoundFilePath(soundPath);

                const abortController = new AbortController();
                const timeout = setTimeout(() => abortController.abort(), 60000);

                try {
                    const audioStream = await audioFetcher.fetchUrlAudio(source, abortController.signal);
                    clearTimeout(timeout);

                    const audio: Uint8Array = await readStreamToBytes(audioStream.stream, { limitBytes: MAX_SOUND_BYTES, sourceName: source });
                    const processedAudio = await audioProcessor.deepProcessAudio(audio, audioStream.formatInfo?.format, audioStream.formatInfo?.container);

                    const binaryAudioStream = Readable.from(processedAudio);
                    await fileManager.writeStream(fullPath, binaryAudioStream);

                    try {
                        await soundRepository.addSound({ name, path: soundPath });
                    } catch (dbError) {
                        // The file is already on disk, so clean it up rather than orphaning it
                        try {
                            await fileManager.deleteFile(fullPath);
                        } catch (cleanupError) {
                            console.error(`[SoundService] Failed to clean up ${fullPath} after a failed insert for sound ${name}:`, cleanupError);
                        }
                        throw dbError;
                    }

                    console.log(`[SoundService] Added sound: ${name} (${processedAudio.length} bytes)`);
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
        getRepeatedSound: async (namesOrSources: string[], delaysMs: number[], abortSignal?: AbortSignal): Promise<string | null> => {
            try {
                const uniqueSounds = [...new Set(namesOrSources)];
                const pcmDataMap = new Map<string, Buffer>();

                for (const nameOrSource of uniqueSounds) {
                    const soundStream = await getSoundInternal(nameOrSource, abortSignal);
                    if (!soundStream) {
                        return null;
                    }

                    const pcmData = await readStreamToBytes(soundStream, { limitBytes: MAX_SOUND_BYTES, sourceName: nameOrSource });
                    pcmDataMap.set(nameOrSource, Buffer.from(pcmData));
                }

                const pcmBuffers = namesOrSources.map(name => pcmDataMap.get(name)!);
                const repeatedStream = createRepeatedPcmStream(pcmBuffers, delaysMs);

                return cacheRepeatedSound(repeatedStream);
            } catch (error) {
                console.error(`[SoundService] Error getting repeated sound:`, error);
                throw error;
            }
        },
        listSounds: async (tagName?: string): Promise<string[]> => {
            const sounds = tagName ? await soundRepository.getAllSoundsWithTagName(tagName) : await soundRepository.getAllSounds();
            return sounds.map(sound => sound.name);
        },
        deleteSound: async (name: string): Promise<void> => {
            try {
                const sound = await soundRepository.getSoundByName(name);
                if (!sound) {
                    throw new Error(`Sound with name ${name} not found`);
                }

                const fullPath = resolveSoundFilePath(sound.path);
                await fileManager.deleteFile(fullPath);
                await soundRepository.deleteSound(sound.name);

                console.log(`[SoundService] Deleted sound: ${name}`);
            } catch (error) {
                console.error(`[SoundService] Error deleting sound ${name}:`, error);
                throw error;
            }
        },
    };
};
