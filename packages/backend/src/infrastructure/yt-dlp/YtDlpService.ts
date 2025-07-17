import { spawn } from "child_process";
import type { Readable } from "stream";

export interface YtDlpService {
    getAudioStream(url: string): Promise<Readable>;
    getVideoInfo(url: string): Promise<YtDlpVideoInfo>;
}

export interface YtDlpVideoInfo {
    title: string;
    duration: number;
    uploader: string;
    url: string;
}

export const createYtDlpService = (): YtDlpService => {
    return {
        async getAudioStream(url: string): Promise<Readable> {
            console.log(`[YtDlpService] Starting audio stream extraction for URL: ${url}`);

            return new Promise((resolve, reject) => {
                const args = ["--extract-audio", "--audio-format", "mp3", "--audio-quality", "0", "--output", "-", "--quiet", url];

                console.log(`[YtDlpService] Spawning yt-dlp process with args:`, args);
                const ytDlpProcess = spawn("yt-dlp", args);

                if (!ytDlpProcess.stdout) {
                    const error = new Error("Failed to create yt-dlp process - stdout is null");
                    console.error(`[YtDlpService] ${error.message}`);
                    reject(error);
                    return;
                }

                console.log(`[YtDlpService] yt-dlp process spawned successfully with PID: ${ytDlpProcess.pid}`);

                ytDlpProcess.stderr?.on("data", data => {
                    const errorMsg = data.toString().trim();
                    console.error(`[YtDlpService] yt-dlp stderr: ${errorMsg}`);
                });

                ytDlpProcess.on("error", error => {
                    const errorMsg = `yt-dlp process error: ${error.message}`;
                    console.error(`[YtDlpService] ${errorMsg}`);
                    reject(new Error(errorMsg));
                });

                ytDlpProcess.on("close", code => {
                    console.log(`[YtDlpService] yt-dlp process closed with code: ${code}`);
                    if (code !== 0) {
                        const error = new Error(`yt-dlp process exited with code ${code}`);
                        console.error(`[YtDlpService] ${error.message}`);
                        reject(error);
                    }
                });

                ytDlpProcess.stdout.on("data", chunk => {
                    console.log(`[YtDlpService] Received audio data chunk of size: ${chunk.length} bytes`);
                });

                ytDlpProcess.stdout.on("end", () => {
                    console.log(`[YtDlpService] Audio stream ended`);
                });

                ytDlpProcess.stdout.on("error", error => {
                    console.error(`[YtDlpService] Audio stream error: ${error.message}`);
                });

                console.log(`[YtDlpService] Returning audio stream for URL: ${url}`);
                resolve(ytDlpProcess.stdout);
            });
        },

        async getVideoInfo(url: string): Promise<YtDlpVideoInfo> {
            console.log(`[YtDlpService] Getting video info for URL: ${url}`);

            return new Promise((resolve, reject) => {
                const args = ["--dump-json", "--no-download", url];
                console.log(`[YtDlpService] Spawning yt-dlp for video info with args:`, args);

                const ytDlpProcess = spawn("yt-dlp", args);

                let output = "";

                ytDlpProcess.stdout?.on("data", data => {
                    const chunk = data.toString();
                    output += chunk;
                    console.log(`[YtDlpService] Received video info data chunk: ${chunk.length} chars`);
                });

                ytDlpProcess.stderr?.on("data", data => {
                    const errorMsg = data.toString().trim();
                    console.error(`[YtDlpService] yt-dlp video info stderr: ${errorMsg}`);
                });

                ytDlpProcess.on("error", error => {
                    const errorMsg = `yt-dlp video info process error: ${error.message}`;
                    console.error(`[YtDlpService] ${errorMsg}`);
                    reject(new Error(errorMsg));
                });

                ytDlpProcess.on("close", code => {
                    console.log(`[YtDlpService] yt-dlp video info process closed with code: ${code}`);

                    if (code !== 0) {
                        const error = new Error(`yt-dlp video info process exited with code ${code}`);
                        console.error(`[YtDlpService] ${error.message}`);
                        reject(error);
                        return;
                    }

                    console.log(`[YtDlpService] Raw video info output length: ${output.length} chars`);

                    try {
                        const videoData = JSON.parse(output);
                        const result = {
                            title: videoData.title || "Unknown Title",
                            duration: videoData.duration || 0,
                            uploader: videoData.uploader || "Unknown Uploader",
                            url: url,
                        };

                        console.log(`[YtDlpService] Parsed video info:`, {
                            title: result.title,
                            duration: result.duration,
                            uploader: result.uploader,
                            url: result.url,
                        });

                        resolve(result);
                    } catch (parseError) {
                        const errorMsg = `Failed to parse yt-dlp JSON output: ${parseError}`;
                        console.error(`[YtDlpService] ${errorMsg}`);
                        console.error(`[YtDlpService] Raw output that failed to parse:`, output.substring(0, 500));
                        reject(new Error(errorMsg));
                    }
                });
            });
        },
    };
};
