import type { AudioFormatInfo } from "@core/entities/AudioFormatInfo.js";
import type { AudioStreamWithMetadata } from "@core/entities/AudioStream.js";
import { createAudioStreamWithFormat } from "@core/entities/AudioStream.js";
import type { AudioFormatDetectionService } from "@core/services/AudioFormatDetectionService.js";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { createReadStream } from "fs";
import { stat, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { Readable } from "stream";

// --- Resource limits -------------------------------------------------------
// Every spawned yt-dlp process is bounded in wall-clock time, output size and
// on-disk size so that a hung/hostile source cannot pin a process forever or
// fill up the temp directory.

// A full audio download of a normal-length video finishes well inside this.
// Anything longer is a hang (dead CDN, throttled stream, livestream that
// slipped past the match-filter) and is killed.
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;

// Metadata-only calls do no real work, so they get a much tighter budget.
const VIDEO_INFO_TIMEOUT_MS = 60 * 1000;

// How long a killed child gets to exit after SIGTERM before it is SIGKILLed.
const KILL_GRACE_PERIOD_MS = 5 * 1000;

// Largest file yt-dlp is allowed to write into the temp directory. Passed
// straight through to `--max-filesize`; ~2 hours of high quality opus.
const MAX_DOWNLOAD_FILESIZE = "150M";

// Upper bound on the JSON blob `--dump-json` may produce before we consider the
// response abusive and abort. Real single-video payloads are well under 1 MB.
const MAX_VIDEO_INFO_OUTPUT_BYTES = 4 * 1024 * 1024;

// yt-dlp filter that refuses livestreams. A livestream never terminates, so
// without this a single `/play` of a live URL would download until the timeout
// (or the max-filesize) is hit. When the filter rejects a URL yt-dlp exits 0
// without writing an output file, which `openDownloadedFile` turns into a clear
// error.
const NOT_LIVE_MATCH_FILTER = "!is_live";

export type YtDlpService = {
    readonly getAudioStream: (url: string, signal?: AbortSignal) => Promise<Readable>;
    readonly getAudioStreamWithFormat: (url: string, signal?: AbortSignal) => Promise<AudioStreamWithMetadata>;
    readonly getVideoInfo: (url: string, signal?: AbortSignal) => Promise<YtDlpVideoInfo>;
};

export type YtDlpVideoInfo = {
    readonly title: string;
    readonly duration: number;
    readonly uploader: string;
    readonly url: string;
    readonly audioFormat?: string; // e.g., "opus", "aac"
    readonly audioContainer?: string; // e.g., "webm", "m4a"
};

// `--format bestaudio` may hand back webm/opus, m4a/aac or something else
// entirely, so the temp file deliberately uses a container-agnostic extension:
// claiming ".webm" for an m4a payload is a lie that only works because the real
// container is detected by ffprobe from the file contents.
const createTempFilePath = (): string => join(tmpdir(), `yt-dlp-${randomUUID()}.audio`);

// Build the argument list for a download. `--` terminates option parsing so a
// URL that begins with "-" can never be interpreted as a flag (defence in
// depth: spawn is used without a shell, and callers only pass http(s) URLs).
export const buildDownloadArgs = (url: string, outputPath: string): string[] => [
    "--format",
    "bestaudio",
    "--output",
    outputPath,
    "--no-part",
    "--no-playlist",
    "--quiet",
    "--max-filesize",
    MAX_DOWNLOAD_FILESIZE,
    "--match-filter",
    NOT_LIVE_MATCH_FILTER,
    "--",
    url,
];

// Build the argument list for a metadata-only lookup.
export const buildVideoInfoArgs = (url: string): string[] => ["--dump-json", "--no-download", "--no-playlist", "--match-filter", NOT_LIVE_MATCH_FILTER, "--", url];

type RunYtDlpOptions = {
    readonly args: readonly string[];
    readonly timeoutMs: number;
    readonly label: string;
    readonly signal?: AbortSignal;
    readonly collectStdout?: boolean;
};

// Spawn yt-dlp and resolve once it exits successfully.
//
// Guarantees:
// - the promise always settles: on exit, on spawn error, on timeout or on abort
// - the child is always terminated (SIGTERM, then SIGKILL after a grace period)
//   when we stop waiting on it, so no orphaned downloads survive a timeout/stop
// - stdout accumulation is bounded when `collectStdout` is set
const runYtDlp = ({ args, timeoutMs, label, signal, collectStdout = false }: RunYtDlpOptions): Promise<string> =>
    new Promise<string>((resolve, reject) => {
        if (signal?.aborted) {
            reject(new Error(`yt-dlp ${label} was cancelled before it started`));
            return;
        }

        const child = spawn("yt-dlp", args, { stdio: ["ignore", "pipe", "pipe"] });

        let stdout = "";
        let settled = false;
        let killTimer: NodeJS.Timeout | undefined;

        // Ask nicely first so yt-dlp can remove its own partial files, then
        // escalate if it is still around after the grace period.
        const terminate = (): void => {
            if (child.exitCode !== null || child.signalCode !== null || killTimer) return;
            child.kill("SIGTERM");
            killTimer = setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_PERIOD_MS);
            killTimer.unref();
        };

        const settle = (error?: Error): void => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutTimer);
            signal?.removeEventListener("abort", onAbort);
            if (error) reject(error);
            else resolve(stdout);
        };

        const timeoutTimer = setTimeout(() => {
            console.error(`[YtDlpService] yt-dlp ${label} timed out after ${timeoutMs}ms, killing process`);
            terminate();
            settle(new Error(`yt-dlp ${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        timeoutTimer.unref();

        const onAbort = (): void => {
            console.log(`[YtDlpService] yt-dlp ${label} cancelled, killing process`);
            terminate();
            settle(new Error(`yt-dlp ${label} was cancelled`));
        };
        signal?.addEventListener("abort", onAbort, { once: true });

        child.stdout?.on("data", (data: Buffer) => {
            if (!collectStdout) return;
            stdout += data.toString();
            if (stdout.length > MAX_VIDEO_INFO_OUTPUT_BYTES) {
                stdout = "";
                terminate();
                settle(new Error(`yt-dlp ${label} produced more than ${MAX_VIDEO_INFO_OUTPUT_BYTES} bytes of output`));
            }
        });

        child.stderr?.on("data", (data: Buffer) => {
            const errorMsg = data.toString().trim();
            if (errorMsg && !errorMsg.includes("[download]")) {
                console.error(`[YtDlpService] yt-dlp ${label} stderr: ${errorMsg}`);
            }
        });

        child.on("error", error => {
            console.error(`[YtDlpService] yt-dlp ${label} process error: ${error.message}`);
            settle(error);
        });

        child.on("close", code => {
            clearTimeout(killTimer);
            if (code !== 0) {
                settle(new Error(`yt-dlp ${label} process exited with code ${code}`));
                return;
            }
            settle();
        });
    });

// Wrap a temp file in an unlink that is safe to call any number of times, from
// any number of handlers.
const createTempFileCleanup = (tempFile: string): (() => void) => {
    let cleaned = false;

    return () => {
        if (cleaned) return;
        cleaned = true;

        void unlink(tempFile).catch((error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT") return;
            console.error(`[YtDlpService] Failed to clean up temp file ${tempFile}: ${error.message}`);
        });
    };
};

// Open the downloaded file and wire up cleanup.
//
// The unlink is attached to "close" rather than "end": "close" fires both on
// normal completion and when a consumer destroys the stream early (e.g. the
// user runs /stop mid-playback), which is exactly the case that used to leak a
// temp file per stopped song.
const openDownloadedFile = async (tempFile: string, cleanup: () => void, signal?: AbortSignal): Promise<Readable> => {
    // yt-dlp exits 0 without producing a file when a filter rejects the URL
    // (livestream) or when --max-filesize is exceeded, so verify explicitly.
    try {
        await stat(tempFile);
    } catch {
        cleanup();
        throw new Error("yt-dlp produced no output file (the source may be a livestream or exceed the maximum allowed size)");
    }

    const fileStream = createReadStream(tempFile, {
        highWaterMark: 64 * 1024,
    });

    fileStream.on("close", () => {
        console.log(`[YtDlpService] Stream closed, cleaning up temp file: ${tempFile}`);
        cleanup();
    });

    fileStream.on("error", error => {
        console.error(`[YtDlpService] File stream error: ${error.message}`);
        cleanup();
    });

    // Cancelling after the download finished should also stop the playback read.
    if (signal) {
        const onAbort = () => fileStream.destroy();
        if (signal.aborted) fileStream.destroy();
        else {
            signal.addEventListener("abort", onAbort, { once: true });
            fileStream.on("close", () => signal.removeEventListener("abort", onAbort));
        }
    }

    return fileStream;
};

export type YtDlpServiceDeps = {
    readonly formatDetectionService?: AudioFormatDetectionService;
};

export const createYtDlpService = ({ formatDetectionService }: YtDlpServiceDeps): YtDlpService => {
    return {
        async getAudioStreamWithFormat(url: string, signal?: AbortSignal): Promise<AudioStreamWithMetadata> {
            console.log(`[YtDlpService] Getting audio stream with format info for URL: ${url}`);

            const tempFile = createTempFilePath();
            const cleanup = createTempFileCleanup(tempFile);
            console.log(`[YtDlpService] Downloading to temporary file: ${tempFile}`);

            try {
                await runYtDlp({ args: buildDownloadArgs(url, tempFile), timeoutMs: DOWNLOAD_TIMEOUT_MS, label: "download", signal });
            } catch (error) {
                cleanup();
                throw error;
            }

            if (formatDetectionService) {
                console.log(`[YtDlpService] Probing downloaded file for accurate format info`);
                try {
                    const formatInfo = await formatDetectionService.detectFromFile(tempFile);
                    console.log(`[YtDlpService] Detected format via ffprobe:`, formatInfo);

                    const fileStream = await openDownloadedFile(tempFile, cleanup, signal);

                    return createAudioStreamWithFormat(fileStream, formatInfo);
                } catch (error) {
                    console.error(`[YtDlpService] Format detection failed: ${error}`);
                    cleanup();
                    throw error;
                }
            }

            console.warn(`[YtDlpService] No format detection service provided, falling back to video info`);

            try {
                const videoInfo = await this.getVideoInfo(url, signal);
                const container = videoInfo.audioContainer || "webm";
                const codec = videoInfo.audioFormat || "opus";
                const format = container === "webm" ? "webm" : container === "m4a" ? "m4a" : container;

                console.log(`[YtDlpService] Detected format from video info: ${format}, container: ${container}, codec: ${codec}`);

                const formatInfo: AudioFormatInfo = {
                    format,
                    container,
                    codec,
                    sampleRate: 48000,
                    channels: 2,
                    bitrate: 0,
                    duration: videoInfo.duration > 0 ? videoInfo.duration : undefined,
                };

                const fileStream = await openDownloadedFile(tempFile, cleanup, signal);

                return createAudioStreamWithFormat(fileStream, formatInfo);
            } catch (error) {
                cleanup();
                throw error;
            }
        },

        async getAudioStream(url: string, signal?: AbortSignal): Promise<Readable> {
            console.log(`[YtDlpService] Starting audio stream extraction for URL: ${url}`);

            const tempFile = createTempFilePath();
            const cleanup = createTempFileCleanup(tempFile);
            console.log(`[YtDlpService] Using temporary file: ${tempFile}`);

            try {
                await runYtDlp({ args: buildDownloadArgs(url, tempFile), timeoutMs: DOWNLOAD_TIMEOUT_MS, label: "download", signal });

                console.log(`[YtDlpService] Creating read stream from temp file: ${tempFile}`);
                return await openDownloadedFile(tempFile, cleanup, signal);
            } catch (error) {
                console.error(`[YtDlpService] Failed to produce audio stream for ${url}: ${error instanceof Error ? error.message : error}`);
                cleanup();
                throw error;
            }
        },

        async getVideoInfo(url: string, signal?: AbortSignal): Promise<YtDlpVideoInfo> {
            console.log(`[YtDlpService] Getting video info for URL: ${url}`);

            const output = await runYtDlp({ args: buildVideoInfoArgs(url), timeoutMs: VIDEO_INFO_TIMEOUT_MS, label: "video info", signal, collectStdout: true });

            console.log(`[YtDlpService] Raw video info output length: ${output.length} chars`);

            try {
                const videoData = JSON.parse(output);

                let audioContainer: string | undefined;
                let audioFormat: string | undefined;

                if (videoData.requested_formats && Array.isArray(videoData.requested_formats)) {
                    const audioFormatData = videoData.requested_formats.find((f: { acodec?: string; ext?: string }) => f.acodec !== "none");
                    if (audioFormatData) {
                        audioContainer = audioFormatData.ext;
                        audioFormat = audioFormatData.acodec;
                    }
                } else {
                    audioContainer = videoData.ext;
                    audioFormat = videoData.acodec;
                }

                const result = {
                    title: videoData.title || "Unknown Title",
                    duration: videoData.duration || 0,
                    uploader: videoData.uploader || "Unknown Uploader",
                    url: url,
                    audioContainer,
                    audioFormat,
                };

                console.log(`[YtDlpService] Parsed video info:`, {
                    title: result.title,
                    duration: result.duration,
                    uploader: result.uploader,
                    url: result.url,
                    audioContainer: result.audioContainer,
                    audioFormat: result.audioFormat,
                });

                return result;
            } catch (parseError) {
                const errorMsg = `Failed to parse yt-dlp JSON output: ${parseError}`;
                console.error(`[YtDlpService] ${errorMsg}`);
                console.error(`[YtDlpService] Raw output that failed to parse:`, output.substring(0, 500));
                throw new Error(errorMsg, { cause: parseError });
            }
        },
    };
};
