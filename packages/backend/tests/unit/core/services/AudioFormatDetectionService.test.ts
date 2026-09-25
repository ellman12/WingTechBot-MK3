import { CorruptedAudioError, FormatDetectionError } from "@core/errors/AudioErrors.js";
import type { AudioProbe, AudioProbeResult } from "@core/ports/services/AudioProbe.js";
import { createAudioFormatDetectionService } from "@core/services/AudioFormatDetectionService.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mp3Probe: AudioProbeResult = {
    streams: [{ codec_name: "mp3", codec_type: "audio", sample_rate: "44100", channels: 2, bit_rate: "128000", duration: "12.5", channel_layout: "stereo", bits_per_sample: 16 }],
    format: { format_name: "mp3", bit_rate: "128000", duration: "12.5" },
};

describe("AudioFormatDetectionService", () => {
    let audioProbe: AudioProbe;

    const createService = () => createAudioFormatDetectionService({ audioProbe });

    beforeEach(() => {
        audioProbe = {
            probeAudio: vi.fn().mockResolvedValue(mp3Probe),
            probeFast: vi.fn().mockResolvedValue(mp3Probe),
        };
    });

    it("maps a probe result onto AudioFormatInfo", async () => {
        expect(await createService().detectFromFile("/sounds/boom.mp3")).toEqual({
            format: "mp3",
            container: "mp3",
            codec: "mp3",
            sampleRate: 44100,
            channels: 2,
            bitrate: 128000,
            duration: 12.5,
            channelLayout: "stereo",
            bitDepth: 16,
        });
        expect(audioProbe.probeAudio).toHaveBeenCalledWith("/sounds/boom.mp3");
    });

    it("uses the first name of a multi-format container as the format", async () => {
        vi.mocked(audioProbe.probeAudio).mockResolvedValue({
            streams: [{ codec_name: "opus", codec_type: "audio", sample_rate: "48000", channels: 2 }],
            format: { format_name: "ogg,opus,webm" },
        });

        const info = await createService().detectFromFile("/sounds/boom.opus");

        expect(info.format).toBe("ogg");
        expect(info.container).toBe("ogg,opus,webm");
    });

    it("leaves an unknown duration off entirely", async () => {
        vi.mocked(audioProbe.probeAudio).mockResolvedValue({
            streams: [{ codec_name: "mp3", codec_type: "audio", sample_rate: "44100", channels: 2 }],
            format: { format_name: "mp3" },
        });

        const info = await createService().detectFromFile("/sounds/boom.mp3");

        expect(info.duration).toBeUndefined();
        expect(info.bitrate).toBe(0);
    });

    it("passes a timeout through when detecting from a URL", async () => {
        await createService().detectFromUrl("https://example.com/boom.mp3", 5000);

        expect(audioProbe.probeAudio).toHaveBeenCalledWith("https://example.com/boom.mp3", 5000);
    });

    it("probes fast for detectFast", async () => {
        await createService().detectFast("/sounds/boom.mp3");

        expect(audioProbe.probeFast).toHaveBeenCalledWith("/sounds/boom.mp3");
    });

    it("throws FormatDetectionError when there is no audio stream", async () => {
        vi.mocked(audioProbe.probeAudio).mockResolvedValue({ streams: [{ codec_name: "h264", codec_type: "video" }], format: { format_name: "mp4" } });

        await expect(createService().detectFromFile("/videos/clip.mp4")).rejects.toBeInstanceOf(FormatDetectionError);
    });

    it("throws CorruptedAudioError when the stream metadata is unusable", async () => {
        vi.mocked(audioProbe.probeAudio).mockResolvedValue({ streams: [{ codec_name: "mp3", codec_type: "audio" }], format: { format_name: "mp3" } });

        await expect(createService().detectFromFile("/sounds/broken.mp3")).rejects.toBeInstanceOf(CorruptedAudioError);
    });

    // detectFromFile only re-throws FormatDetectionError/CorruptedAudioError untouched, so an
    // UnsupportedFormatError from parsing comes back out wrapped. Documented as-is.
    it("reports an unknown codec as unsupported", async () => {
        vi.mocked(audioProbe.probeAudio).mockResolvedValue({
            streams: [{ codec_name: "unknown", codec_type: "audio", sample_rate: "44100", channels: 2 }],
            format: { format_name: "mp3" },
        });

        await expect(createService().detectFromFile("/sounds/weird.mp3")).rejects.toThrow("Unsupported or unknown audio format");
    });

    it("wraps a probe failure in FormatDetectionError", async () => {
        vi.mocked(audioProbe.probeAudio).mockRejectedValue(new Error("ffprobe exploded"));

        await expect(createService().detectFromFile("/sounds/boom.mp3")).rejects.toThrow("Failed to detect format from file: ffprobe exploded");
    });
});
