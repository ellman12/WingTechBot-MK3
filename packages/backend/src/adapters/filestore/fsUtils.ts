import fs from "fs";
import path from "path";
import type { Readable } from "stream";

export const isNotFound = (error: unknown): boolean => (error as NodeJS.ErrnoException)?.code === "ENOENT";

export const ensureParentDir = async (filePath: string): Promise<void> => {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
};

export const writeFileEnsuringDir = async (filePath: string, content: string | Uint8Array): Promise<void> => {
    await ensureParentDir(filePath);
    await fs.promises.writeFile(filePath, content);
};

export const unlinkIfExists = async (filePath: string): Promise<void> => {
    try {
        await fs.promises.unlink(filePath);
    } catch (error) {
        if (!isNotFound(error)) throw error;
    }
};

//Large buffer for smoother audio streaming.
export const createAudioReadStream = (filePath: string): Readable => {
    const stream = fs.createReadStream(filePath, { highWaterMark: 256 * 1024 });
    stream.on("error", error => {
        console.error(`[FileStore] Read stream error for ${filePath}:`, error);
    });
    return stream;
};
