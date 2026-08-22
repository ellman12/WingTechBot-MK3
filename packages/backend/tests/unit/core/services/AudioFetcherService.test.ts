import { AudioNotFoundError, AudioSizeLimitError } from "@core/errors/AudioErrors.js";
import type { SoundRepository } from "@core/ports/repositories/SoundRepository.js";
import type { FileManager } from "@core/ports/services/FileManager.js";
import type { YoutubeService } from "@core/ports/services/YoutubeService.js";
import type { AudioCacheService } from "@core/services/AudioCacheService.js";
import type { AudioFetcherDeps } from "@core/services/AudioFetcherService.js";
import { createAudioFetcherService, getUrlExtension } from "@core/services/AudioFetcherService.js";
import { readStreamToBytes } from "@core/utils/streamUtils.js";
import { Readable } from "stream";
import { afterEach, describe, expect, it, vi } from "vitest";

const readAll = async (stream: Readable): Promise<Buffer> => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
    return Buffer.concat(chunks);
};

const createDeps = (overrides: Partial<AudioFetcherDeps> = {}): AudioFetcherDeps => {
    const cacheService: AudioCacheService = {
        getCached: vi.fn().mockResolvedValue(null),
        saveToCache: vi.fn().mockResolvedValue(undefined),
        cleanExpired: vi.fn().mockResolvedValue(undefined),
        stopCleanup: vi.fn(),
    };

    const youtubeService: YoutubeService = {
        fetchAudioFromYoutube: vi.fn(),
    };

    const soundRepository = {
        getSoundByName: vi.fn().mockResolvedValue(null),
    } as unknown as SoundRepository;

    const fileManager = {
        fileExists: vi.fn().mockResolvedValue(false),
        readStream: vi.fn(),
    } as unknown as FileManager;

    return { cacheService, youtubeService, soundRepository, fileManager, ...overrides };
};

const okResponse = (bytes: Uint8Array, headers: Record<string, string> = {}): Response => new Response(Buffer.from(bytes), { status: 200, headers });

describe("AudioFetcherService", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe("getUrlExtension", () => {
        it("ignores query strings that contain dots", () => {
            // Discord CDN attachment links always carry ?ex=..&is=..&hm=.. - splitting the raw
            // string on "." used to yield garbage like "ef&hm=123" here.
            expect(getUrlExtension("https://cdn.discordapp.com/attachments/1/2/clip.mp3?ex=abc&is=d.ef&hm=123")).toBe("mp3");
        });

        it("only looks at the last path segment", () => {
            expect(getUrlExtension("https://example.com/a.b/song")).toBeUndefined();
        });

        it("reads a plain extension", () => {
            expect(getUrlExtension("https://files.catbox.moe/xyz.mp3")).toBe("mp3");
        });

        it("lowercases the extension and ignores the fragment", () => {
            expect(getUrlExtension("https://example.com/track.WAV#t=10")).toBe("wav");
        });

        it("returns undefined when there is no extension", () => {
            expect(getUrlExtension("https://example.com/stream")).toBeUndefined();
            expect(getUrlExtension("https://example.com/")).toBeUndefined();
            expect(getUrlExtension("https://example.com/trailing.")).toBeUndefined();
        });

        it("returns undefined for a malformed URL instead of throwing", () => {
            expect(getUrlExtension("not a url at all.mp3")).toBeUndefined();
            expect(getUrlExtension("")).toBeUndefined();
        });
    });

    describe("fetchUrlAudio format detection", () => {
        it("resolves the format table entry for a Discord CDN attachment", async () => {
            vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(new Uint8Array([1, 2, 3]))));

            const deps = createDeps();
            const fetcher = createAudioFetcherService(deps);
            const result = await fetcher.fetchUrlAudio("https://cdn.discordapp.com/attachments/1/2/clip.mp3?ex=abc&is=d.ef&hm=123");

            expect(result.formatInfo?.format).toBe("mp3");
            expect(result.formatInfo?.codec).toBe("mp3");
            // Numeric fields are explicit "unknown" sentinels, not guesses about the real stream.
            expect(result.formatInfo?.sampleRate).toBe(0);
            expect(result.formatInfo?.channels).toBe(0);
            expect(result.formatInfo?.bitrate).toBe(0);
        });

        it("leaves formatInfo undefined for an unknown extension", async () => {
            vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(new Uint8Array([1, 2, 3]))));

            const fetcher = createAudioFetcherService(createDeps());
            const result = await fetcher.fetchUrlAudio("https://example.com/stream");

            expect(result.formatInfo).toBeUndefined();
        });

        it("caches the detected format alongside the audio", async () => {
            vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(new Uint8Array([1, 2, 3]))));

            const deps = createDeps();
            const fetcher = createAudioFetcherService(deps);
            await fetcher.fetchUrlAudio("https://files.catbox.moe/xyz.ogg");

            expect(deps.cacheService.saveToCache).toHaveBeenCalledWith("https://files.catbox.moe/xyz.ogg", expect.any(Buffer), expect.objectContaining({ codec: "vorbis" }));
        });
    });

    describe("single-flight", () => {
        it("shares one download between concurrent requests for the same URL", async () => {
            let release: (response: Response) => void = () => {};
            const pending = new Promise<Response>(resolve => {
                release = resolve;
            });
            const fetchMock = vi.fn().mockReturnValue(pending);
            vi.stubGlobal("fetch", fetchMock);

            const deps = createDeps();
            const fetcher = createAudioFetcherService(deps);

            const first = fetcher.fetchUrlAudio("https://files.catbox.moe/xyz.mp3");
            const second = fetcher.fetchUrlAudio("https://files.catbox.moe/xyz.mp3");

            release(okResponse(new Uint8Array([1, 2, 3, 4])));
            const [a, b] = await Promise.all([first, second]);

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(deps.cacheService.saveToCache).toHaveBeenCalledTimes(1);

            // Each caller must get its own stream - a Readable cannot be consumed twice.
            expect(a.stream).not.toBe(b.stream);
            expect(await readAll(a.stream)).toEqual(Buffer.from([1, 2, 3, 4]));
            expect(await readAll(b.stream)).toEqual(Buffer.from([1, 2, 3, 4]));
        });

        it("does not share downloads between different URLs", async () => {
            const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(okResponse(new Uint8Array([1]))));
            vi.stubGlobal("fetch", fetchMock);

            const fetcher = createAudioFetcherService(createDeps());
            await Promise.all([fetcher.fetchUrlAudio("https://files.catbox.moe/a.mp3"), fetcher.fetchUrlAudio("https://files.catbox.moe/b.mp3")]);

            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it("releases the in-flight entry so a later request downloads again", async () => {
            const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(okResponse(new Uint8Array([1]))));
            vi.stubGlobal("fetch", fetchMock);

            const fetcher = createAudioFetcherService(createDeps());
            await fetcher.fetchUrlAudio("https://files.catbox.moe/a.mp3");
            await fetcher.fetchUrlAudio("https://files.catbox.moe/a.mp3");

            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it("propagates a failure to every joined caller and clears the entry", async () => {
            const fetchMock = vi.fn().mockRejectedValue(new Error("boom"));
            vi.stubGlobal("fetch", fetchMock);

            const fetcher = createAudioFetcherService(createDeps());
            const first = fetcher.fetchUrlAudio("https://files.catbox.moe/a.mp3");
            const second = fetcher.fetchUrlAudio("https://files.catbox.moe/a.mp3");

            await expect(first).rejects.toThrow("boom");
            await expect(second).rejects.toThrow("boom");

            await expect(fetcher.fetchUrlAudio("https://files.catbox.moe/a.mp3")).rejects.toThrow("boom");
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });
    });

    describe("size cap", () => {
        it("rejects a body that streams past the limit", async () => {
            const stream = Readable.from([Buffer.alloc(8), Buffer.alloc(8)]);

            await expect(readStreamToBytes(stream, { limitBytes: 10, sourceName: "https://example.com/big.mp3" })).rejects.toBeInstanceOf(AudioSizeLimitError);
        });

        it("accepts a body exactly at the limit", async () => {
            const stream = Readable.from([Buffer.alloc(10)]);

            await expect(readStreamToBytes(stream, { limitBytes: 10, sourceName: "https://example.com/ok.mp3" })).resolves.toHaveLength(10);
        });

        it("rejects up front when Content-Length declares an oversized body", async () => {
            vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(new Uint8Array([1]), { "content-length": String(512 * 1024 * 1024) })));

            const fetcher = createAudioFetcherService(createDeps());

            await expect(fetcher.fetchUrlAudio("https://files.catbox.moe/huge.mp3")).rejects.toBeInstanceOf(AudioSizeLimitError);
        });
    });

    describe("typed errors", () => {
        it("throws AudioNotFoundError on a 404", async () => {
            vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 404 })));

            const fetcher = createAudioFetcherService(createDeps());

            await expect(fetcher.fetchUrlAudio("https://files.catbox.moe/gone.mp3")).rejects.toBeInstanceOf(AudioNotFoundError);
        });

        it("throws AudioNotFoundError for an unknown soundboard sound", async () => {
            const fetcher = createAudioFetcherService(createDeps());

            await expect(fetcher.fetchSoundboardAudio("missing")).rejects.toBeInstanceOf(AudioNotFoundError);
        });
    });

    describe("cache", () => {
        it("returns the cached stream without fetching", async () => {
            const fetchMock = vi.fn();
            vi.stubGlobal("fetch", fetchMock);

            const deps = createDeps();
            vi.mocked(deps.cacheService.getCached).mockResolvedValue({ stream: Readable.from([Buffer.from([9])]) });

            const fetcher = createAudioFetcherService(deps);
            const result = await fetcher.fetchUrlAudio("https://files.catbox.moe/a.mp3");

            expect(fetchMock).not.toHaveBeenCalled();
            expect(await readAll(result.stream)).toEqual(Buffer.from([9]));
        });
    });
});
