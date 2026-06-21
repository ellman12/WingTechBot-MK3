import type { Config } from "@core/config/Config.js";
import type { SoundRepository } from "@core/repositories/SoundRepository.js";
import { createRepeatedPcmStream } from "@core/utils/audio/pcmRepeater.js";
import { logger } from "@core/utils/logger.js";
import { createPreBufferedStream, readStreamToBytes } from "@core/utils/streamUtils.js";
import { Readable } from "stream";

import { type AudioFetcherService, parseAudioSource } from "./AudioFetcherService.js";
import type { AudioProcessingService } from "./AudioProcessingService.js";
import type { FileManager } from "./FileManager.js";

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

export const createSoundService = ({ audioFetcher, audioProcessor, fileManager, soundRepository, config }: SoundServiceDeps): SoundService => {
    const AUDIO_FILE_STORE_PATH = config.sounds.storagePath;

    // Cache for temporary repeated sounds. Each entry self-evicts after a TTL so a sound
    // that's generated but never played (e.g. the user disconnects) can't leak its buffered
    // PCM for the lifetime of the process.
    const REPEATED_SOUND_TTL_MS = 5 * 60 * 1000;
    type RepeatedSoundEntry = { stream: Readable; evictTimer: NodeJS.Timeout };
    const repeatedSoundCache = new Map<string, RepeatedSoundEntry>();

    const evictRepeatedSound = (key: string, destroyStream: boolean): Readable | null => {
        const entry = repeatedSoundCache.get(key);
        if (!entry) return null;
        clearTimeout(entry.evictTimer);
        repeatedSoundCache.delete(key);
        if (destroyStream && !entry.stream.destroyed) {
            entry.stream.destroy();
        }
        return entry.stream;
    };

    const getSoundInternal = async (nameOrSource: string, abortSignal?: AbortSignal): Promise<Readable | null> => {
        // Check if this is a cached repeated sound
        const cachedRepeated = repeatedSoundCache.get(nameOrSource);
        if (cachedRepeated) {
            return evictRepeatedSound(nameOrSource, false);
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

                    const soundPath = `${AUDIO_FILE_STORE_PATH}${sound.path}`;
                    return fileManager.readStream(soundPath);
                }
                case "url":
                case "youtube": {
                    const audioStream = await audioFetcher.fetchUrlAudio(nameOrSource, abortSignal);
                    const processedStream = audioProcessor.processAudioStream(audioStream);
                    const preBufferedStream = await createPreBufferedStream(processedStream, `url:${nameOrSource}`, abortSignal);

                    logger.debug(`[SoundService] Fetched and buffered ${nameOrSource} in ${Date.now() - startTime}ms`);
                    return preBufferedStream;
                }
            }
        } catch (error) {
            logger.error(`[SoundService] Error getting sound ${nameOrSource}:`, error);
            throw error;
        }
    };

    return {
        addSound: async (name: string, source: string): Promise<void> => {
            try {
                const abortController = new AbortController();
                const timeout = setTimeout(() => abortController.abort(), 60000);

                try {
                    const audioStream = await audioFetcher.fetchUrlAudio(source, abortController.signal);
                    clearTimeout(timeout);

                    const audio: Uint8Array = await readStreamToBytes(audioStream.stream);
                    const processedAudio = await audioProcessor.deepProcessAudio(audio, audioStream.formatInfo?.format, audioStream.formatInfo?.container);

                    const path = `/${name}.pcm`;
                    const fullPath = `${AUDIO_FILE_STORE_PATH}${path}`;

                    const binaryAudioStream = Readable.from(processedAudio);
                    await fileManager.writeStream(fullPath, binaryAudioStream);
                    await soundRepository.addSound({ name, path });

                    logger.debug(`[SoundService] Added sound: ${name} (${processedAudio.length} bytes)`);
                } catch (fetchError) {
                    clearTimeout(timeout);
                    throw fetchError;
                }
            } catch (error) {
                logger.error(`[SoundService] Error adding sound ${name}:`, error);
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

                    const pcmData = await readStreamToBytes(soundStream);
                    pcmDataMap.set(nameOrSource, Buffer.from(pcmData));
                }

                const pcmBuffers = namesOrSources.map(name => pcmDataMap.get(name)!);
                const repeatedStream = createRepeatedPcmStream(pcmBuffers, delaysMs);

                const tempName = `temp-repeated-${Date.now()}`;
                const evictTimer = setTimeout(() => {
                    logger.warn(`[SoundService] Repeated sound ${tempName} was never played; evicting after TTL`);
                    evictRepeatedSound(tempName, true);
                }, REPEATED_SOUND_TTL_MS);
                // Don't keep the event loop alive just for the eviction timer.
                evictTimer.unref?.();
                repeatedSoundCache.set(tempName, { stream: repeatedStream, evictTimer });

                return tempName;
            } catch (error) {
                logger.error(`[SoundService] Error getting repeated sound:`, error);
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

                const fullPath = `${AUDIO_FILE_STORE_PATH}${sound.path}`;
                await fileManager.deleteFile(fullPath);
                await soundRepository.deleteSound(sound.name);

                logger.debug(`[SoundService] Deleted sound: ${name}`);
            } catch (error) {
                logger.error(`[SoundService] Error deleting sound ${name}:`, error);
                throw error;
            }
        },
    };
};
