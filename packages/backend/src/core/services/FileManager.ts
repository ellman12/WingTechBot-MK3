import type { Readable } from "stream";

export type FileManager = {
    readFile: (path: string) => Promise<string>;
    readStream: (path: string) => Readable;
    writeFile: (path: string, content: string) => Promise<void>;
    writeStream: (path: string, content: Readable) => Promise<void>;
    deleteFile: (path: string) => Promise<void>;
    fileExists: (path: string) => Promise<boolean>;
    listFiles: (directory: string) => Promise<string[]>;
};
