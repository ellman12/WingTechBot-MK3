import type { Readable } from "stream";

export const readStreamToBytes = (stream: Readable): Promise<Uint8Array> => {
    return new Promise((resolve, reject) => {
        const chunks: Uint8Array[] = [];
        stream.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
        });
        stream.on("end", () => {
            resolve(Buffer.concat(chunks));
        });
        stream.on("error", err => {
            reject(err);
        });
    });
};
