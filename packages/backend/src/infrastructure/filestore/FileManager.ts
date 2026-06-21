import type { FileManager } from "@core/services/FileManager.js";
import { logger } from "@core/utils/logger.js";
import fs from "fs";
import os from "os";
import path from "path";
import type { Readable } from "stream";

export const createFileManager = (): FileManager => {
    const CACHE_DIR = path.join(os.tmpdir(), ".wtb-cache");

    const ensureDirectoryExists = async (filePath: string): Promise<void> => {
        const dir = path.dirname(filePath);
        try {
            await fs.promises.access(dir, fs.constants.F_OK);
        } catch {
            logger.debug(`[FileManager] Creating directory: ${dir}`);
            await fs.promises.mkdir(dir, { recursive: true });
            logger.debug(`[FileManager] Directory created successfully: ${dir}`);
        }
    };

    const ensureCacheDir = async (): Promise<void> => {
        try {
            await fs.promises.access(CACHE_DIR, fs.constants.F_OK);
        } catch {
            await fs.promises.mkdir(CACHE_DIR, { recursive: true });
        }
    };

    return {
        readFile: async (path: string) => {
            return fs.promises.readFile(path, "binary");
        },
        readStream: (path: string): Readable => {
            logger.debug(`[FileManager] Creating optimized read stream for: ${path}`);

            // Optimized buffer settings for audio streaming
            const stream = fs.createReadStream(path, {
                highWaterMark: 256 * 1024, // 256KB buffer for smoother streaming
                autoClose: true,
                emitClose: true,
            });

            // Add stream monitoring
            stream.on("open", () => {
                logger.debug(`[FileManager] File stream opened: ${path}`);
            });

            stream.on("error", error => {
                logger.error(`[FileManager] File stream error for ${path}:`, error);
            });

            stream.on("end", () => {
                logger.debug(`[FileManager] File stream ended: ${path}`);
            });

            return stream;
        },
        writeFile: async (filePath: string, content: string) => {
            logger.debug(`[FileManager] Writing file: ${filePath}`);

            try {
                await ensureDirectoryExists(filePath);

                return new Promise<void>((resolve, reject) => {
                    fs.writeFile(filePath, content, "utf8", err => {
                        if (err) {
                            logger.error(`[FileManager] Error writing file ${filePath}:`, err);
                            reject(err);
                        } else {
                            logger.debug(`[FileManager] File written successfully: ${filePath}`);
                            resolve();
                        }
                    });
                });
            } catch (error) {
                logger.error(`[FileManager] Error ensuring directory exists for ${filePath}:`, error);
                throw error;
            }
        },
        writeStream: async (filePath: string, content: Readable) => {
            logger.debug(`[FileManager] Writing stream to file: ${filePath}`);

            try {
                await ensureDirectoryExists(filePath);

                return new Promise<void>((resolve, reject) => {
                    const writeStream = fs.createWriteStream(filePath);

                    content.pipe(writeStream);

                    writeStream.on("finish", () => {
                        logger.debug(`[FileManager] Stream written successfully: ${filePath}`);
                        resolve();
                    });

                    writeStream.on("error", err => {
                        logger.error(`[FileManager] Error writing stream to ${filePath}:`, err);
                        reject(err);
                    });
                });
            } catch (error) {
                logger.error(`[FileManager] Error ensuring directory exists for ${filePath}:`, error);
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
        getFileStats: async (path: string) => {
            return new Promise((resolve, reject) => {
                fs.stat(path, (err, stats) => {
                    if (err) {
                        if (err.code === "ENOENT") {
                            resolve(null);
                        } else {
                            reject(err);
                        }
                    } else {
                        resolve(stats);
                    }
                });
            });
        },

        // Temp cache management
        getCachePath: (filename: string) => {
            return path.join(CACHE_DIR, filename);
        },

        readCache: async <T>(filename: string): Promise<T | null> => {
            try {
                const cachePath = path.join(CACHE_DIR, filename);
                const data = await fs.promises.readFile(cachePath, "utf-8");
                return JSON.parse(data) as T;
            } catch {
                return null;
            }
        },

        writeCache: async <T>(filename: string, data: T): Promise<void> => {
            await ensureCacheDir();
            const cachePath = path.join(CACHE_DIR, filename);
            await fs.promises.writeFile(cachePath, JSON.stringify(data, null, 2), "utf-8");
        },

        deleteCache: async (filename: string): Promise<void> => {
            try {
                const cachePath = path.join(CACHE_DIR, filename);
                await fs.promises.unlink(cachePath);
            } catch {
                // Ignore if file doesn't exist
            }
        },

        clearAllCache: async (): Promise<void> => {
            try {
                const files = await fs.promises.readdir(CACHE_DIR);
                await Promise.all(files.map(file => fs.promises.unlink(path.join(CACHE_DIR, file))));
            } catch {
                // Ignore if directory doesn't exist
            }
        },
    };
};
