import { spawn } from "child_process";
import type { Readable } from "stream";

export interface YtDlpService {
    readonly getAudioStream: (url: string) => Promise<Readable>;
    readonly getVideoInfo: (url: string) => Promise<YtDlpVideoInfo>;
}

export interface YtDlpVideoInfo {
    readonly title: string;
    readonly duration: number;
    readonly uploader: string;
    readonly url: string;
}

export const createYtDlpService = (): YtDlpService => {
    return {
        async getAudioStream(url: string): Promise<Readable> {
            console.log(`[YtDlpService] Starting audio stream extraction for URL: ${url}`);

            return new Promise((resolve, reject) => {
                const args = [
                    "--format",
                    "bestaudio", // Get best audio stream directly without extraction
                    "--output",
                    "-", // Output to stdout
                    "--buffer-size",
                    "4M", // Increased buffer for better streaming
                    "--concurrent-fragments",
                    "3", // Download multiple fragments concurrently
                    "--throttled-rate",
                    "100K", // Minimum download rate
                    "--no-part", // Don't use .part files for streaming
                    "--hls-use-mpegts", // Use mpegts for HLS streams (better for streaming)
                    "--no-playlist", // Don't download playlists, just single video
                    "--quiet",
                    url,
                ];

                console.log(`[YtDlpService] Spawning yt-dlp process with args:`, args);
                const ytDlpProcess = spawn("yt-dlp", args, {
                    stdio: ["pipe", "pipe", "pipe"],
                    // Optimize buffer sizes for streaming
                    env: { ...process.env, PYTHONUNBUFFERED: "1" },
                });

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
                    console.error(`[YtDlpService] yt-dlp process error: ${error.message}`);
                    reject(error);
                });

                let hasResolved = false;

                ytDlpProcess.on("close", code => {
                    console.log(`[YtDlpService] yt-dlp process closed with code: ${code}`);
                    if (code !== 0 && !hasResolved) {
                        const error = new Error(`yt-dlp process exited with code ${code}`);
                        console.error(`[YtDlpService] ${error.message}`);
                        reject(error);
                    }
                });

                ytDlpProcess.stdout.on("data", chunk => {
                    console.log(`[YtDlpService] Received audio data chunk of size: ${chunk.length} bytes`);
                    if (!hasResolved) {
                        hasResolved = true;
                        console.log(`[YtDlpService] Returning audio stream for URL: ${url}`);
                        resolve(ytDlpProcess.stdout);
                    }
                });

                ytDlpProcess.stdout.on("end", () => {
                    console.log(`[YtDlpService] Audio stream ended`);
                });

                ytDlpProcess.stdout.on("error", error => {
                    console.error(`[YtDlpService] Audio stream error: ${error.message}`);
                    if (!hasResolved) {
                        hasResolved = true;
                        reject(error);
                    }
                });

                // Set a timeout to reject if no data is received
                setTimeout(() => {
                    if (!hasResolved) {
                        hasResolved = true;
                        const error = new Error("Timeout waiting for audio stream data");
                        console.error(`[YtDlpService] ${error.message}`);
                        reject(error);
                    }
                }, 10000);
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
                    console.error(`[YtDlpService] yt-dlp video info process error: ${error.message}`);
                    reject(error);
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
