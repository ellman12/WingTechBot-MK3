import { createFfmpegAudioProcessingService } from "@adapters/services/FfmpegAudioProcessingService";
import { createFfmpegService } from "@infrastructure/ffmpeg/FfmpegService";
import { readFile, writeFile } from "fs/promises";
import { describe, it } from "vitest";

describe("Audio File Processing Test", () => {
    it("should output opus file", async () => {
        // This is a simple test to verify our test setup works
        // In a real implementation, you'd test the actual health endpoint
        const ffmpegAudioService = createFfmpegAudioProcessingService({
            ffmpeg: createFfmpegService(),
        });

        const inputFilePath = "./tests/integration/ffmpeg/test.mp3";
        const outputFilePath = "./tests/integration/ffmpeg/test.ogg";

        // Read in the test audio file as a

        const audioInput = await readFile(inputFilePath);

        const audioOutput = await ffmpegAudioService.deepProcessAudio(audioInput);

        // Write the output to a file

        await writeFile(outputFilePath, audioOutput);
    });
});
