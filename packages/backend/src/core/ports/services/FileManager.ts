import type fs from "fs";
import type { Readable } from "stream";

export type FileManager = {
    readonly readFile: (path: string) => Promise<string>;
    readonly readStream: (path: string) => Readable;
    readonly writeFile: (path: string, content: string) => Promise<void>;
    readonly writeStream: (path: string, content: Readable) => Promise<void>;
    readonly deleteFile: (path: string) => Promise<void>;
    // Atomically moves a file. Both paths must be on the same filesystem (in practice: same directory).
    // Used for write-to-temp-then-rename so readers never observe a half-written file.
    readonly renameFile: (oldPath: string, newPath: string) => Promise<void>;
    readonly fileExists: (path: string) => Promise<boolean>;
    // Lists the entries of `directory` as paths joined onto `directory`, NOT bare basenames,
    // so the results can be passed straight back into getFileStats/deleteFile/readStream.
    readonly listFiles: (directory: string) => Promise<string[]>;
    readonly getFileStats: (path: string) => Promise<fs.Stats | null>;

    // Temp cache management
    readonly getCachePath: (filename: string) => string;
    readonly readCache: <T>(filename: string) => Promise<T | null>;
    readonly writeCache: <T>(filename: string, data: T) => Promise<void>;
    readonly deleteCache: (filename: string) => Promise<void>;
    readonly clearAllCache: () => Promise<void>;
};
