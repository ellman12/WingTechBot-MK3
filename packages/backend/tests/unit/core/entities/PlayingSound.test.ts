import { createPlayingSound } from "@core/entities/PlayingSound.js";
import { Readable } from "stream";
import { describe, expect, it } from "vitest";

describe.concurrent("PlayingSound", () => {
    describe("createPlayingSound", () => {
        it("should create PlayingSound with format metadata", () => {
            const stream = Readable.from(["test audio data"]);
            const metadata = {
                source: "test-sound",
                server: "server-123",
                formatInfo: {
                    format: "s16le",
                    container: "s16le",
                    codec: "pcm_s16le",
                    sampleRate: 48000,
                    channels: 2,
                    bitrate: 0,
                },
            };

            const playingSound = createPlayingSound("id-123", stream, 0.8, metadata);

            expect(playingSound.id).toBe("id-123");
            expect(playingSound.stream).toBe(stream);
            expect(playingSound.volume).toBe(0.8);
            expect(playingSound.metadata).toEqual(metadata);
            expect(playingSound.metadata?.source).toBe("test-sound");
            expect(playingSound.metadata?.server).toBe("server-123");
            expect(playingSound.metadata?.formatInfo?.format).toBe("s16le");
            expect(playingSound.metadata?.formatInfo?.container).toBe("s16le");
            expect(playingSound.metadata?.formatInfo?.codec).toBe("pcm_s16le");
            expect(playingSound.abortController).toBeDefined();
            expect(typeof playingSound.abort).toBe("function");
        });

        it("should create PlayingSound with YouTube format metadata", () => {
            const stream = Readable.from(["youtube audio"]);
            const metadata = {
                source: "https://youtube.com/watch?v=test",
                server: "server-456",
                formatInfo: {
                    format: "webm",
                    container: "webm,opus",
                    codec: "opus",
                    sampleRate: 48000,
                    channels: 2,
                    bitrate: 128000,
                },
            };

            const playingSound = createPlayingSound("yt-123", stream, 1.0, metadata);

            expect(playingSound.id).toBe("yt-123");
            expect(playingSound.metadata?.formatInfo?.format).toBe("webm");
            expect(playingSound.metadata?.formatInfo?.codec).toBe("opus");
        });

        it("should work without metadata (backward compatibility)", () => {
            const stream = Readable.from(["test audio"]);
            const playingSound = createPlayingSound("id-123", stream, 1.0);

            expect(playingSound.id).toBe("id-123");
            expect(playingSound.stream).toBe(stream);
            expect(playingSound.volume).toBe(1.0);
            expect(playingSound.metadata).toBeUndefined();
            expect(playingSound.abortController).toBeDefined();
        });

        it("should work with partial metadata", () => {
            const stream = Readable.from(["test audio"]);
            const metadata = {
                source: "partial-sound",
                // No server or formatInfo
            };

            const playingSound = createPlayingSound("id-456", stream, 0.5, metadata);

            expect(playingSound.metadata?.source).toBe("partial-sound");
            expect(playingSound.metadata?.server).toBeUndefined();
            expect(playingSound.metadata?.formatInfo).toBeUndefined();
        });

        it("should clamp volume to valid range (0-1)", () => {
            const stream = Readable.from(["test"]);

            const tooLow = createPlayingSound("id-1", stream, -0.5);
            expect(tooLow.volume).toBe(0);

            const tooHigh = createPlayingSound("id-2", stream, 1.5);
            expect(tooHigh.volume).toBe(1);

            const valid = createPlayingSound("id-3", stream, 0.7);
            expect(valid.volume).toBe(0.7);
        });

        it("should provide abort functionality", () => {
            const stream = Readable.from(["test"]);
            const playingSound = createPlayingSound("id-123", stream, 1.0);

            expect(stream.destroyed).toBe(false);

            playingSound.abort();

            expect(stream.destroyed).toBe(true);
            expect(playingSound.abortController.signal.aborted).toBe(true);
        });

        it("should handle abort via abortController signal", () => {
            const stream = Readable.from(["test"]);
            const playingSound = createPlayingSound("id-123", stream, 1.0);

            expect(stream.destroyed).toBe(false);

            playingSound.abortController.abort();

            expect(stream.destroyed).toBe(true);
        });

        it("should not throw error when aborting already destroyed stream", () => {
            const stream = Readable.from(["test"]);
            const playingSound = createPlayingSound("id-123", stream, 1.0);

            stream.destroy();
            expect(stream.destroyed).toBe(true);

            // Should not throw
            expect(() => playingSound.abort()).not.toThrow();
        });
    });
});
