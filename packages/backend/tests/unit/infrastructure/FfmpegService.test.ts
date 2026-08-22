import { createFfmpegService } from "@infrastructure/ffmpeg/FfmpegService.js";
import { EventEmitter } from "events";
import ffmpeg from "fluent-ffmpeg";
import type { FfmpegCommand } from "fluent-ffmpeg";
import { PassThrough, Readable, type Writable } from "stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fluent-ffmpeg", () => ({ default: vi.fn() }));

// Mirrors the module-level constants in FfmpegService.
const MAX_CONCURRENT_FFMPEG_PROCESSES = 4;
const CONVERT_TIMEOUT_MS = 5 * 60 * 1000;
const STREAM_TIMEOUT_MS = 60 * 60 * 1000;
const KILL_GRACE_PERIOD_MS = 5 * 1000;

const PCM_OPTIONS = {
    inputFormat: "webm",
    outputFormat: "s16le",
    codec: "pcm_s16le",
    sampleRate: 48000,
    channels: 2,
};

const createFakeCommand = () => {
    const events = new EventEmitter();
    const command = {
        events,
        addInputOptions: vi.fn(),
        addOutputOptions: vi.fn(),
        inputFormat: vi.fn(),
        audioCodec: vi.fn(),
        audioFrequency: vi.fn(),
        audioChannels: vi.fn(),
        audioBitrate: vi.fn(),
        format: vi.fn(),
        kill: vi.fn(),
        on: vi.fn(),
        pipe: vi.fn(),
    };

    for (const method of [command.addInputOptions, command.addOutputOptions, command.inputFormat, command.audioCodec, command.audioFrequency, command.audioChannels, command.audioBitrate, command.format, command.kill]) {
        method.mockReturnValue(command);
    }

    command.on.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        events.on(event, handler);
        return command;
    });
    command.pipe.mockImplementation((destination?: Writable) => destination ?? new PassThrough());

    return command;
};

type FakeCommand = ReturnType<typeof createFakeCommand>;

const flush = () => new Promise(resolve => setImmediate(resolve));

const streamAt = (streams: Readable[], index: number): Readable => {
    const stream = streams[index];
    if (!stream) throw new Error(`No output stream at index ${index}`);
    return stream;
};

describe("FfmpegService", () => {
    let commands: FakeCommand[];

    const commandAt = (index: number): FakeCommand => {
        const command = commands[index];
        if (!command) throw new Error(`No ffmpeg command was created at index ${index}`);
        return command;
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});

        commands = [];
        vi.mocked(ffmpeg).mockImplementation(() => {
            const command = createFakeCommand();
            commands.push(command);
            return command as unknown as FfmpegCommand;
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe("command flags", () => {
        it("does not pass x264 or muxer options that a raw pcm output ignores", async () => {
            const service = createFfmpegService();
            service.convertStreamToStream(Readable.from(["audio"]), PCM_OPTIONS);
            await flush();

            const outputOptions = commandAt(0).addOutputOptions.mock.calls.flat(2);
            for (const deadFlag of ["-preset", "ultrafast", "-tune", "zerolatency", "-avoid_negative_ts", "-max_muxing_queue_size"]) {
                expect(outputOptions).not.toContain(deadFlag);
            }
        });

        it("applies the timestamp fixups as input options", async () => {
            const service = createFfmpegService();
            service.convertStreamToStream(Readable.from(["audio"]), PCM_OPTIONS);
            await flush();

            expect(commandAt(0).addInputOptions).toHaveBeenCalledWith(["-fflags", "+genpts+igndts"]);
            expect(commandAt(0).addOutputOptions.mock.calls.flat(2)).not.toContain("-fflags");
        });

        it("still forwards caller supplied output options", async () => {
            const service = createFfmpegService();
            service.convertStreamToStream(Readable.from(["audio"]), { ...PCM_OPTIONS, extraArgs: ["-filter:a", "loudnorm=I=-24"] });
            await flush();

            expect(commandAt(0).addOutputOptions).toHaveBeenCalledWith(["-filter:a", "loudnorm=I=-24"]);
            expect(commandAt(0).format).toHaveBeenCalledWith("s16le");
            expect(commandAt(0).audioCodec).toHaveBeenCalledWith("pcm_s16le");
        });
    });

    describe("concurrency limiter", () => {
        it("never spawns more than the configured number of ffmpeg processes", async () => {
            const service = createFfmpegService();
            const streams = Array.from({ length: MAX_CONCURRENT_FFMPEG_PROCESSES + 2 }, () => service.convertStreamToStream(Readable.from(["audio"]), PCM_OPTIONS));
            await flush();

            expect(commands).toHaveLength(MAX_CONCURRENT_FFMPEG_PROCESSES);
            expect(streams).toHaveLength(MAX_CONCURRENT_FFMPEG_PROCESSES + 2);
        });

        it("starts a queued conversion when a running one finishes", async () => {
            const service = createFfmpegService();
            // An ffmpeg error destroys the returned stream, so every stream needs a listener.
            Array.from({ length: MAX_CONCURRENT_FFMPEG_PROCESSES + 2 }, () => service.convertStreamToStream(Readable.from(["audio"]), PCM_OPTIONS).on("error", () => {}));
            await flush();

            commandAt(0).events.emit("end");
            await flush();
            expect(commands).toHaveLength(MAX_CONCURRENT_FFMPEG_PROCESSES + 1);

            commandAt(1).events.emit("error", new Error("ffmpeg blew up"));
            await flush();
            expect(commands).toHaveLength(MAX_CONCURRENT_FFMPEG_PROCESSES + 2);
        });

        it("releases the slot and kills ffmpeg when the consumer destroys the output early", async () => {
            const service = createFfmpegService();
            const streams = Array.from({ length: MAX_CONCURRENT_FFMPEG_PROCESSES + 1 }, () => service.convertStreamToStream(Readable.from(["audio"]), PCM_OPTIONS));
            await flush();

            expect(commands).toHaveLength(MAX_CONCURRENT_FFMPEG_PROCESSES);

            streamAt(streams, 0).destroy();
            await flush();

            expect(commandAt(0).kill).toHaveBeenCalledWith("SIGTERM");
            expect(commands).toHaveLength(MAX_CONCURRENT_FFMPEG_PROCESSES + 1);
        });

        it("does not spawn ffmpeg for a queued conversion whose output was already abandoned", async () => {
            const service = createFfmpegService();
            const streams = Array.from({ length: MAX_CONCURRENT_FFMPEG_PROCESSES + 1 }, () => service.convertStreamToStream(Readable.from(["audio"]), PCM_OPTIONS));
            await flush();

            // The queued one is abandoned before a slot frees up.
            streamAt(streams, MAX_CONCURRENT_FFMPEG_PROCESSES).destroy();
            commandAt(0).events.emit("end");
            await flush();

            expect(commands).toHaveLength(MAX_CONCURRENT_FFMPEG_PROCESSES);
        });

        it("does not leak slots across buffer conversions", async () => {
            const service = createFfmpegService();

            for (let i = 0; i < MAX_CONCURRENT_FFMPEG_PROCESSES + 2; i++) {
                const promise = service.convertAudio(new Uint8Array([1, 2, 3]), PCM_OPTIONS);
                await flush();
                commandAt(i).events.emit("end");
                await expect(promise).resolves.toBeInstanceOf(Buffer);
            }

            expect(commands).toHaveLength(MAX_CONCURRENT_FFMPEG_PROCESSES + 2);
        });
    });

    describe("timeouts", () => {
        it("kills a stuck buffer conversion with SIGTERM then SIGKILL", async () => {
            vi.useFakeTimers();

            const service = createFfmpegService();
            const promise = service.convertAudio(new Uint8Array([1, 2, 3]), PCM_OPTIONS);
            const assertion = expect(promise).rejects.toThrow(/timed out/);

            await vi.advanceTimersByTimeAsync(CONVERT_TIMEOUT_MS);
            expect(commandAt(0).kill).toHaveBeenCalledWith("SIGTERM");

            await vi.advanceTimersByTimeAsync(KILL_GRACE_PERIOD_MS);
            expect(commandAt(0).kill).toHaveBeenCalledWith("SIGKILL");

            await assertion;
        });

        it("kills a stuck streaming conversion and destroys the output", async () => {
            vi.useFakeTimers();

            const service = createFfmpegService();
            const stream = service.convertStreamToStream(Readable.from(["audio"]), PCM_OPTIONS);
            const error = new Promise<Error>(resolve => stream.on("error", resolve));

            await vi.advanceTimersByTimeAsync(STREAM_TIMEOUT_MS);

            expect(commandAt(0).kill).toHaveBeenCalledWith("SIGTERM");
            expect((await error).message).toMatch(/timed out/);
            expect(stream.destroyed).toBe(true);
        });

        it("does not kill a conversion that finishes in time", async () => {
            vi.useFakeTimers();

            const service = createFfmpegService();
            const promise = service.convertAudio(new Uint8Array([1, 2, 3]), PCM_OPTIONS);
            await vi.advanceTimersByTimeAsync(0);

            commandAt(0).events.emit("end");
            await expect(promise).resolves.toBeInstanceOf(Buffer);

            await vi.advanceTimersByTimeAsync(CONVERT_TIMEOUT_MS * 2);
            expect(commandAt(0).kill).not.toHaveBeenCalled();
        });
    });
});
