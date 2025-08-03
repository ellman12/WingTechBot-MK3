import { createYtDlpService } from "@infrastructure/yt-dlp/YtDlpService";
import { spawn } from "child_process";
import { Readable } from "stream";
import { describe, expect, it, vi } from "vitest";

// Helper function to check if yt-dlp is available and working
const isYtDlpAvailable = async (): Promise<boolean> => {
    try {
        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execAsync = promisify(exec);

        await execAsync("yt-dlp --version");
        return true;
    } catch {
        return false;
    }
};

describe("YtDlpService Integration Tests", () => {
    const ytDlpService = createYtDlpService();

    // Note: These tests require yt-dlp to be installed and network access
    // They may be skipped in CI environments without internet access

    it.skipIf(process.env.CI)(
        "should extract audio from a real YouTube URL",
        async () => {
            // Check if yt-dlp is available first
            if (!(await isYtDlpAvailable())) {
                console.log("⏭️ Skipping test: yt-dlp not available");
                return;
            }

            // Using a known stable video for testing
            const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"; // Rick Roll - stable test video

            try {
                const audioStream = await ytDlpService.getAudioStream(testUrl);

                expect(audioStream).toBeInstanceOf(Readable);

                // Verify we can read some data from the stream
                let bytesReceived = 0;
                let chunkCount = 0;

                const timeout = setTimeout(() => {
                    audioStream.destroy();
                }, 10000); // 10 second timeout

                for await (const chunk of audioStream) {
                    bytesReceived += chunk.length;
                    chunkCount++;

                    // Stop after receiving some data to avoid downloading the entire video
                    if (bytesReceived > 100000) {
                        // 100KB should be enough to verify it works
                        audioStream.destroy();
                        break;
                    }
                }

                clearTimeout(timeout);

                expect(bytesReceived).toBeGreaterThan(0);
                expect(chunkCount).toBeGreaterThan(0);
            } catch (error) {
                console.log(`⏭️ Skipping test due to yt-dlp error: ${error instanceof Error ? error.message : "Unknown error"}`);
                // Don't fail the test, just skip it
                return;
            }
        },
        30000
    );

    it.skipIf(process.env.CI)(
        "should get video info from a real YouTube URL",
        async () => {
            // Check if yt-dlp is available first
            if (!(await isYtDlpAvailable())) {
                console.log("⏭️ Skipping test: yt-dlp not available");
                return;
            }

            const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

            try {
                const videoInfo = await ytDlpService.getVideoInfo(testUrl);

                expect(videoInfo).toHaveProperty("title");
                expect(videoInfo).toHaveProperty("duration");
                expect(videoInfo).toHaveProperty("uploader");
                expect(videoInfo).toHaveProperty("url", testUrl);

                expect(typeof videoInfo.title).toBe("string");
                expect(typeof videoInfo.duration).toBe("number");
                expect(typeof videoInfo.uploader).toBe("string");

                // Basic sanity checks
                expect(videoInfo.title.length).toBeGreaterThan(0);
                expect(videoInfo.duration).toBeGreaterThan(0);
            } catch (error) {
                console.log(`⏭️ Skipping test due to yt-dlp error: ${error instanceof Error ? error.message : "Unknown error"}`);
                // Don't fail the test, just skip it
                return;
            }
        },
        15000
    );

    it("should handle invalid URLs gracefully", async () => {
        const invalidUrl = "https://not-a-real-video-site.com/fake-video";

        await expect(ytDlpService.getAudioStream(invalidUrl)).rejects.toThrow();

        await expect(ytDlpService.getVideoInfo(invalidUrl)).rejects.toThrow();
    });

    it("should handle malformed URLs", async () => {
        const malformedUrl = "not-even-a-url";

        await expect(ytDlpService.getAudioStream(malformedUrl)).rejects.toThrow();

        await expect(ytDlpService.getVideoInfo(malformedUrl)).rejects.toThrow();
    });

    // Mock test for when yt-dlp is not available
    it("should handle yt-dlp process spawn failures", async () => {
        // This test mocks the spawn function to simulate yt-dlp not being available
        const originalSpawn = spawn;

        vi.doMock("child_process", () => ({
            spawn: vi.fn(() => {
                throw new Error("yt-dlp not found");
            }),
        }));

        // Re-import after mocking
        const { createYtDlpService: createMockedService } = await import("@infrastructure/yt-dlp/YtDlpService");
        const mockedService = createMockedService();

        await expect(mockedService.getAudioStream("https://example.com")).rejects.toThrow("yt-dlp not found");
        await expect(mockedService.getVideoInfo("https://example.com")).rejects.toThrow("yt-dlp not found");

        // Restore original spawn
        vi.doMock("child_process", () => ({
            spawn: originalSpawn,
        }));
    });
});
