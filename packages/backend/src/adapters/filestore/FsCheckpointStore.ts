import type { CheckpointStore } from "@core/ports/repositories/CheckpointStore.js";
import fs from "fs";
import os from "os";
import path from "path";

import { isNotFound, unlinkIfExists, writeFileEnsuringDir } from "./fsUtils.js";

export type FsCheckpointStoreDeps = {
    readonly directory?: string;
};

//Stores each key as <directory>/<key>.json. Defaults to the OS temp dir, so checkpoints survive restarts but not reboots.
export const createFsCheckpointStore = ({ directory = path.join(os.tmpdir(), ".wtb-cache") }: FsCheckpointStoreDeps = {}): CheckpointStore => {
    const filePath = (key: string) => path.join(directory, `${key}.json`);

    console.log(`[FsCheckpointStore] Storing checkpoints in ${directory}`);

    return {
        load: async <T>(key: string): Promise<T | null> => {
            try {
                return JSON.parse(await fs.promises.readFile(filePath(key), "utf8")) as T;
            } catch (error) {
                if (!isNotFound(error)) {
                    console.warn(`[FsCheckpointStore] Ignoring unreadable checkpoint ${key}:`, error);
                }
                return null;
            }
        },
        save: async (key, value) => {
            await writeFileEnsuringDir(filePath(key), JSON.stringify(value, null, 2));
        },
        clear: async key => {
            await unlinkIfExists(filePath(key));
        },
    };
};
