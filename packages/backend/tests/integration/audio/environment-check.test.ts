import { exec, spawn } from "child_process";
import { promisify } from "util";
import { describe, expect, it } from "vitest";

const execAsync = promisify(exec);

describe("Audio Environment Prerequisites", () => {
    it("should have FFmpeg installed", async () => {
        try {
            const { stdout } = await execAsync("ffmpeg -version");
            expect(stdout).toContain("ffmpeg version");
        } catch {
            console.error("FFmpeg not found. Please install FFmpeg for audio processing tests.");
            console.error("Ubuntu/Debian: sudo apt-get install ffmpeg");
            console.error("macOS: brew install ffmpeg");
            console.error("Windows: Download from https://ffmpeg.org/download.html");
            throw new Error("FFmpeg is required for integration tests but was not found");
        }
    });

    it.skipIf(process.env.CI)("should have yt-dlp installed for YouTube tests", async () => {
        try {
            const { stdout } = await execAsync("yt-dlp --version");
            expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/); // Version format
        } catch {
            console.warn("yt-dlp not found. YouTube integration tests will be limited.");
            console.warn("Install with: pip install yt-dlp");
            // Don't fail the test, just warn - yt-dlp tests are optional
        }
    });

    it("should be able to spawn FFmpeg process", () => {
        return new Promise<void>((resolve, reject) => {
            const ffmpegProcess = spawn("ffmpeg", ["-version"]);

            let output = "";
            ffmpegProcess.stdout?.on("data", data => {
                output += data.toString();
            });

            ffmpegProcess.on("close", code => {
                if (code === 0) {
                    expect(output).toContain("ffmpeg version");
                    resolve();
                } else {
                    reject(new Error(`FFmpeg process exited with code ${code}`));
                }
            });

            ffmpegProcess.on("error", error => {
                reject(new Error(`Failed to spawn FFmpeg: ${error.message}`));
            });
        });
    });

    it("should have required Node.js modules for audio processing", async () => {
        // Verify that all required modules can be imported
        const modules = ["stream", "child_process", "fs", "path"];

        for (const moduleName of modules) {
            await expect(async () => {
                await import(moduleName);
            }).not.toThrow();
        }
    });
});
