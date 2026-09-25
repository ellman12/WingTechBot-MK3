import type { Config } from "@core/config/Config.js";
import type { AudioFormatInfo } from "@core/entities/AudioFormatInfo.js";
import type { AudioCacheEntry, AudioCacheStore } from "@core/ports/repositories/AudioCacheStore.js";
import fs from "fs";
import path from "path";

import { createAudioReadStream, isNotFound, unlinkIfExists, writeFileEnsuringDir } from "./fsUtils.js";

export type FsAudioCacheStoreDeps = {
    readonly config: Config;
};

type AudioCacheMetadata = {
    readonly formatInfo?: AudioFormatInfo;
    readonly cachedAt: number;
};

const AUDIO_SUFFIX = ".cache";
const METADATA_SUFFIX = ".meta.json";

//Each entry is <key>.cache holding the audio plus an optional <key>.meta.json holding its format.
export const createFsAudioCacheStore = ({ config }: FsAudioCacheStoreDeps): AudioCacheStore => {
    const dir = config.cache.audioDownloadPath;
    const audioPath = (key: string) => path.join(dir, `${key}${AUDIO_SUFFIX}`);
    const metadataPath = (key: string) => path.join(dir, `${key}${METADATA_SUFFIX}`);

    const stat = async (key: string): Promise<AudioCacheEntry | null> => {
        try {
            const stats = await fs.promises.stat(audioPath(key));
            return { key, sizeBytes: stats.size, cachedAt: stats.mtime };
        } catch (error) {
            if (isNotFound(error)) return null;
            throw error;
        }
    };

    const readFormatInfo = async (key: string): Promise<AudioFormatInfo | undefined> => {
        try {
            const metadata: AudioCacheMetadata = JSON.parse(await fs.promises.readFile(metadataPath(key), "utf8"));
            return metadata.formatInfo;
        } catch (error) {
            if (!isNotFound(error)) {
                console.warn(`[FsAudioCacheStore] Failed to read metadata for ${key}:`, error);
            }
            return undefined;
        }
    };

    return {
        stat,
        read: async key => {
            const formatInfo = await readFormatInfo(key);
            const stream = createAudioReadStream(audioPath(key));
            return formatInfo ? { stream, formatInfo } : { stream };
        },
        write: async (key, audio, formatInfo) => {
            await writeFileEnsuringDir(audioPath(key), audio);
            if (formatInfo) {
                const metadata: AudioCacheMetadata = { formatInfo, cachedAt: Date.now() };
                await writeFileEnsuringDir(metadataPath(key), JSON.stringify(metadata, null, 2));
            } else {
                //Don't leave a stale format from a previous entry under the same key.
                await unlinkIfExists(metadataPath(key));
            }
        },
        delete: async key => {
            await unlinkIfExists(audioPath(key));
            await unlinkIfExists(metadataPath(key));
        },
        list: async () => {
            let files: string[];
            try {
                files = await fs.promises.readdir(dir);
            } catch (error) {
                if (isNotFound(error)) return [];
                throw error;
            }

            const keys = files.filter(file => file.endsWith(AUDIO_SUFFIX)).map(file => file.slice(0, -AUDIO_SUFFIX.length));
            const entries = await Promise.all(keys.map(stat));
            return entries.filter((entry): entry is AudioCacheEntry => entry !== null);
        },
    };
};
