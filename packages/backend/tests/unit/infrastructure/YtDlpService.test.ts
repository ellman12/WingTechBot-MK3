import { buildDownloadArgs, buildVideoInfoArgs, createYtDlpService } from "@infrastructure/yt-dlp/YtDlpService.js";
import type { ChildProcess } from "child_process";
import { spawn } from "child_process";
import { EventEmitter } from "events";
import { createReadStream } from "fs";
import type { Stats } from "fs";
import { stat, unlink } from "fs/promises";
import { PassThrough } from "stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("child_process", async importOriginal => {
    const actual = await importOriginal<typeof import("child_process")>();
    return { ...actual, spawn: vi.fn() };
});

vi.mock("fs", async importOriginal => {
    const actual = await importOriginal<typeof import("fs")>();
    return { ...actual, createReadStream: vi.fn() };
});

vi.mock("fs/promises", async importOriginal => {
    const actual = await importOriginal<typeof import("fs/promises")>();
    return { ...actual, unlink: vi.fn(), stat: vi.fn() };
});

// Mirrors the module-level constants in YtDlpService.
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const VIDEO_INFO_TIMEOUT_MS = 60 * 1000;
const KILL_GRACE_PERIOD_MS = 5 * 1000;

const TEST_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

type FakeChild = EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    exitCode: number | null;
    signalCode: string | null;
    kill: ReturnType<typeof vi.fn>;
};

const createFakeChild = (): FakeChild => {
    const child = new EventEmitter() as FakeChild;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.exitCode = null;
    child.signalCode = null;
    child.kill = vi.fn(() => true);
    return child;
};

// Queue the next child that `spawn` should hand back.
const nextChild = (): FakeChild => {
    const child = createFakeChild();
    vi.mocked(spawn).mockReturnValueOnce(child as unknown as ChildProcess);
    return child;
};

const flush = () => new Promise(resolve => setImmediate(resolve));

// Args of the first (and in these tests only) yt-dlp spawn.
const spawnedArgs = (): string[] => {
    const call = vi.mocked(spawn).mock.calls[0];
    if (!call) throw new Error("yt-dlp was never spawned");
    return call[1] as string[];
};

describe("YtDlpService", () => {
    let fileStream: PassThrough;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});

        fileStream = new PassThrough();
        vi.mocked(createReadStream).mockReturnValue(fileStream as unknown as ReturnType<typeof createReadStream>);
        vi.mocked(unlink).mockResolvedValue(undefined);
        vi.mocked(stat).mockResolvedValue({ size: 1024 } as Stats);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe("argument construction", () => {
        it("adds a max filesize cap, a livestream guard and a -- terminator to download args", () => {
            const args = buildDownloadArgs(TEST_URL, "/tmp/out.audio");

            expect(args).toContain("--max-filesize");
            expect(args[args.indexOf("--max-filesize") + 1]).toMatch(/^\d+[KMG]$/);

            expect(args).toContain("--match-filter");
            expect(args[args.indexOf("--match-filter") + 1]).toBe("!is_live");

            // "--" must be the last option, immediately before the URL, so a URL
            // starting with "-" can never be parsed as a flag.
            expect(args.at(-2)).toBe("--");
            expect(args.at(-1)).toBe(TEST_URL);
        });

        it("adds a livestream guard and a -- terminator to video info args", () => {
            const args = buildVideoInfoArgs(TEST_URL);

            expect(args).toContain("--dump-json");
            expect(args).toContain("--no-download");
            expect(args[args.indexOf("--match-filter") + 1]).toBe("!is_live");
            expect(args.at(-2)).toBe("--");
            expect(args.at(-1)).toBe(TEST_URL);
        });

        it("passes the hardened args to spawn and uses a uuid temp filename", async () => {
            const child = nextChild();
            const promise = createYtDlpService({}).getAudioStream(TEST_URL);

            expect(spawn).toHaveBeenCalledWith("yt-dlp", expect.arrayContaining(["--max-filesize", "--match-filter", "--"]), expect.objectContaining({ stdio: ["ignore", "pipe", "pipe"] }));

            const args = spawnedArgs();
            const outputPath = args[args.indexOf("--output") + 1];
            expect(outputPath).toMatch(/yt-dlp-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.audio$/);

            child.emit("close", 0);
            await expect(promise).resolves.toBe(fileStream);
        });
    });

    describe("timeouts", () => {
        it("kills a hung download with SIGTERM then SIGKILL and rejects", async () => {
            vi.useFakeTimers();

            const child = nextChild();
            const promise = createYtDlpService({}).getAudioStream(TEST_URL);
            const assertion = expect(promise).rejects.toThrow(/timed out/);

            await vi.advanceTimersByTimeAsync(DOWNLOAD_TIMEOUT_MS);
            expect(child.kill).toHaveBeenCalledWith("SIGTERM");

            await vi.advanceTimersByTimeAsync(KILL_GRACE_PERIOD_MS);
            expect(child.kill).toHaveBeenCalledWith("SIGKILL");

            await assertion;
            expect(unlink).toHaveBeenCalledTimes(1);
        });

        it("times out a hung video info lookup", async () => {
            vi.useFakeTimers();

            const child = nextChild();
            const promise = createYtDlpService({}).getVideoInfo(TEST_URL);
            const assertion = expect(promise).rejects.toThrow(/timed out/);

            await vi.advanceTimersByTimeAsync(VIDEO_INFO_TIMEOUT_MS);
            expect(child.kill).toHaveBeenCalledWith("SIGTERM");

            await assertion;
        });

        it("does not time out a download that completes in time", async () => {
            vi.useFakeTimers();

            const child = nextChild();
            const promise = createYtDlpService({}).getAudioStream(TEST_URL);

            child.emit("close", 0);
            await expect(promise).resolves.toBe(fileStream);

            await vi.advanceTimersByTimeAsync(DOWNLOAD_TIMEOUT_MS * 2);
            expect(child.kill).not.toHaveBeenCalled();
        });
    });

    describe("cancellation", () => {
        it("rejects without spawning when the signal is already aborted", async () => {
            const controller = new AbortController();
            controller.abort();

            await expect(createYtDlpService({}).getAudioStream(TEST_URL, controller.signal)).rejects.toThrow(/cancelled/);
            expect(spawn).not.toHaveBeenCalled();
        });

        it("kills the process and rejects when aborted mid-download", async () => {
            const controller = new AbortController();
            const child = nextChild();
            const promise = createYtDlpService({}).getAudioStream(TEST_URL, controller.signal);

            controller.abort();

            await expect(promise).rejects.toThrow(/cancelled/);
            expect(child.kill).toHaveBeenCalledWith("SIGTERM");
            expect(unlink).toHaveBeenCalledTimes(1);
        });

        it("destroys the returned stream when aborted during playback", async () => {
            const controller = new AbortController();
            const child = nextChild();
            const promise = createYtDlpService({}).getAudioStream(TEST_URL, controller.signal);

            child.emit("close", 0);
            const stream = await promise;

            controller.abort();
            await flush();

            expect(stream.destroyed).toBe(true);
            expect(unlink).toHaveBeenCalledTimes(1);
        });
    });

    describe("temp file cleanup", () => {
        it("removes the temp file when the consumer destroys the stream early", async () => {
            const child = nextChild();
            const promise = createYtDlpService({}).getAudioStream(TEST_URL);

            child.emit("close", 0);
            const stream = await promise;

            expect(unlink).not.toHaveBeenCalled();

            // /stop destroys the stream mid-playback: "end" never fires, only "close".
            stream.destroy();
            await flush();

            const args = spawnedArgs();
            expect(unlink).toHaveBeenCalledWith(args[args.indexOf("--output") + 1]);
            expect(unlink).toHaveBeenCalledTimes(1);
        });

        it("is idempotent when cleanup is triggered more than once", async () => {
            const child = nextChild();
            const promise = createYtDlpService({}).getAudioStream(TEST_URL);

            child.emit("close", 0);
            const stream = await promise;

            stream.emit("error", new Error("boom"));
            stream.destroy();
            stream.emit("close");
            await flush();

            expect(unlink).toHaveBeenCalledTimes(1);
        });

        it("swallows ENOENT from a temp file that is already gone", async () => {
            const enoent: NodeJS.ErrnoException = Object.assign(new Error("no such file"), { code: "ENOENT" });
            vi.mocked(unlink).mockRejectedValue(enoent);

            const child = nextChild();
            const promise = createYtDlpService({}).getAudioStream(TEST_URL);

            child.emit("close", 0);
            const stream = await promise;
            stream.destroy();
            await flush();

            expect(unlink).toHaveBeenCalledTimes(1);
        });

        it("removes the temp file when yt-dlp exits non-zero", async () => {
            const child = nextChild();
            const promise = createYtDlpService({}).getAudioStream(TEST_URL);

            child.emit("close", 1);

            await expect(promise).rejects.toThrow(/exited with code 1/);
            expect(unlink).toHaveBeenCalledTimes(1);
            expect(createReadStream).not.toHaveBeenCalled();
        });

        it("rejects and cleans up when yt-dlp exits cleanly without writing a file", async () => {
            // What happens when --match-filter rejects a livestream or
            // --max-filesize is exceeded: exit code 0, no output file.
            vi.mocked(stat).mockRejectedValue(Object.assign(new Error("no such file"), { code: "ENOENT" }));

            const child = nextChild();
            const promise = createYtDlpService({}).getAudioStream(TEST_URL);

            child.emit("close", 0);

            await expect(promise).rejects.toThrow(/no output file/);
            expect(unlink).toHaveBeenCalledTimes(1);
        });
    });

    describe("getVideoInfo", () => {
        it("parses the json payload", async () => {
            const child = nextChild();
            const promise = createYtDlpService({}).getVideoInfo(TEST_URL);

            child.stdout.emit("data", Buffer.from(JSON.stringify({ title: "Never Gonna Give You Up", duration: 212, uploader: "Rick Astley", ext: "webm", acodec: "opus" })));
            child.emit("close", 0);

            await expect(promise).resolves.toMatchObject({ title: "Never Gonna Give You Up", duration: 212, uploader: "Rick Astley", url: TEST_URL, audioContainer: "webm", audioFormat: "opus" });
        });

        it("aborts and rejects when stdout grows past the cap instead of buffering forever", async () => {
            const child = nextChild();
            const promise = createYtDlpService({}).getVideoInfo(TEST_URL);

            // 5 MB of output against a 4 MB cap.
            const megabyte = Buffer.alloc(1024 * 1024, "x");
            for (let i = 0; i < 5; i++) {
                child.stdout.emit("data", megabyte);
            }

            await expect(promise).rejects.toThrow(/more than \d+ bytes of output/);
            expect(child.kill).toHaveBeenCalledWith("SIGTERM");
        });
    });
});
