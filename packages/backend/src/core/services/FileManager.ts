import type fs from "fs";
import type { Readable } from "stream";

export type FileManager = {
    readonly readFile: (path: string) => Promise<string>;
    readonly readStream: (path: string) => Readable;
    readonly writeFile: (path: string, content: string) => Promise<void>;
    readonly writeStream: (path: string, content: Readable) => Promise<void>;
    readonly deleteFile: (path: string) => Promise<void>;
    readonly fileExists: (path: string) => Promise<boolean>;
    readonly listFiles: (directory: string) => Promise<string[]>;
    readonly getFileStats: (path: string) => Promise<fs.Stats>;
};
