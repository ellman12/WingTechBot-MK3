import { validateSoundName } from "@core/entities/Sound.js";
import { describe, expect, it } from "vitest";

describe("validateSoundName", () => {
    it("accepts an ordinary name", () => {
        expect(validateSoundName("boom")).toBeUndefined();
        expect(validateSoundName("boom-2")).toBeUndefined();
    });

    it("rejects the reserved name random", () => {
        expect(validateSoundName("random")).toBe(`Cannot use reserved name "random" for a sound.`);
    });

    it("rejects the reserved name currently-playing", () => {
        expect(validateSoundName("currently-playing")).toBe(`Cannot use reserved name "currently-playing" for a sound.`);
    });

    it("rejects names starting with # because those mean tags", () => {
        expect(validateSoundName("#funny")).toBe(`Cannot use names starting with "#" (reserved for tags).`);
    });

    it("rejects commas because those separate multiple sounds", () => {
        expect(validateSoundName("boom,clap")).toBe(`Cannot use commas in sound names (reserved for multi-sound selection).`);
    });

    it("allows names that merely resemble the reserved ones", () => {
        expect(validateSoundName("randomly")).toBeUndefined();
        expect(validateSoundName("not-currently-playing")).toBeUndefined();
    });

    it("rejects characters outside the allowlist wherever they appear", () => {
        // Sound names become file names on disk, so this is an allowlist rather than a
        // blocklist of the reserved prefixes: "#" is refused anywhere, not just leading.
        expect(validateSoundName("boom#")).toBeDefined();
        expect(validateSoundName("boom!")).toBeDefined();
    });
});
