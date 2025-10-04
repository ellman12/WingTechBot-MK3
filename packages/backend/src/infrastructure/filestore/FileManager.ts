import type { FileManager } from "@core/services/FileManager.js";
import fs from "fs";
import path from "path";
import type { Readable } from "stream";

export const createFileManager = (): FileManager => {
    const ensureDirectoryExists = async (filePath: string): Promise<void> => {
        const dir = path.dirname(filePath);
        try {
            await fs.promises.access(dir, fs.constants.F_OK);
        } catch {
            console.log(`[FileManager] Creating directory: ${dir}`);
            await fs.promises.mkdir(dir, { recursive: true });
            console.log(`[FileManager] Directory created successfully: ${dir}`);
        }
    };

    return {
        readFile: async (path: string) => {
            return fs.promises.readFile(path, "binary");
        },
        readStream: (path: string): Readable => {
            console.log(`[FileManager] Creating optimized read stream for: ${path}`);

            // Optimized buffer settings for audio streaming
            const stream = fs.createReadStream(path, {
                highWaterMark: 256 * 1024, // Increased to 256KB buffer for smoother streaming
                autoClose: true,
                emitClose: true,
            });

            // Add stream monitoring
            stream.on("open", () => {
                console.log(`[FileManager] File stream opened: ${path}`);
            });

            stream.on("error", error => {
                console.error(`[FileManager] File stream error for ${path}:`, error);
            });

            stream.on("end", () => {
                console.log(`[FileManager] File stream ended: ${path}`);
            });

            return stream;
        },
        writeFile: async (filePath: string, content: string) => {
            console.log(`[FileManager] Writing file: ${filePath}`);

            try {
                await ensureDirectoryExists(filePath);

                return new Promise<void>((resolve, reject) => {
                    fs.writeFile(filePath, content, "utf8", err => {
                        if (err) {
                            console.error(`[FileManager] Error writing file ${filePath}:`, err);
                            reject(err);
                        } else {
                            console.log(`[FileManager] File written successfully: ${filePath}`);
                            resolve();
                        }
                    });
                });
            } catch (error) {
                console.error(`[FileManager] Error ensuring directory exists for ${filePath}:`, error);
                throw error;
            }
        },
        writeStream: async (filePath: string, content: Readable) => {
            console.log(`[FileManager] Writing stream to file: ${filePath}`);

            try {
                await ensureDirectoryExists(filePath);

                return new Promise<void>((resolve, reject) => {
                    const writeStream = fs.createWriteStream(filePath);

                    content.pipe(writeStream);

                    writeStream.on("finish", () => {
                        console.log(`[FileManager] Stream written successfully: ${filePath}`);
                        resolve();
                    });

                    writeStream.on("error", err => {
                        console.error(`[FileManager] Error writing stream to ${filePath}:`, err);
                        reject(err);
                    });
                });
            } catch (error) {
                console.error(`[FileManager] Error ensuring directory exists for ${filePath}:`, error);
                throw error;
            }
        },

        deleteFile: async (path: string) => {
            return new Promise((resolve, reject) => {
                fs.unlink(path, err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        },

        fileExists: async (path: string) => {
            return new Promise(resolve => {
                fs.access(path, fs.constants.F_OK, err => {
                    resolve(!err);
                });
            });
        },

        listFiles: async (directory: string) => {
            return new Promise((resolve, reject) => {
                fs.readdir(directory, (err, files) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(files);
                    }
                });
            });
        },
    };
};
