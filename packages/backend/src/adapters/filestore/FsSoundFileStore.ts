import type { Config } from "@core/config/Config.js";
import type { SoundFileStore } from "@core/ports/repositories/SoundFileStore.js";
import path from "path";

import { createAudioReadStream, unlinkIfExists, writeFileEnsuringDir } from "./fsUtils.js";

export type FsSoundFileStoreDeps = {
    readonly config: Config;
};

export const createFsSoundFileStore = ({ config }: FsSoundFileStoreDeps): SoundFileStore => {
    const resolve = (soundPath: string): string => path.join(config.sounds.storagePath, soundPath);

    return {
        read: soundPath => createAudioReadStream(resolve(soundPath)),
        write: async (soundPath, audio) => {
            await writeFileEnsuringDir(resolve(soundPath), audio);
        },
        delete: async soundPath => {
            await unlinkIfExists(resolve(soundPath));
        },
    };
};
