import { splitMessage } from "@core/utils/textUtils.js";
import { describe, expect, it } from "vitest";

describe("splitMessage", () => {
    it("returns the text unchanged when it fits", () => {
        expect(splitMessage("short", 10)).toEqual(["short"]);
    });

    it("returns the text unchanged when it is exactly the limit", () => {
        expect(splitMessage("1234567890", 10)).toEqual(["1234567890"]);
    });

    it("splits at the last newline before the limit", () => {
        const text = `${"a".repeat(5)}\n${"b".repeat(20)}`;
        expect(splitMessage(text, 10)).toEqual(["aaaaa", "bbbbbbbbbb", "bbbbbbbbbb"]);
    });

    it("splits at a sentence boundary when there is no newline", () => {
        const text = `Hello there. ${"b".repeat(20)}`;
        const parts = splitMessage(text, 15);
        expect(parts[0]).toBe("Hello there.");
        expect(parts.slice(1).join("")).toBe("b".repeat(20));
    });

    it("splits at a space when there is no newline or sentence boundary", () => {
        const text = `${"a".repeat(8)} ${"b".repeat(20)}`;
        const parts = splitMessage(text, 12);
        expect(parts[0]).toBe("a".repeat(8));
    });

    it("hard splits into chunks of exactly maxLen when there is no boundary at all", () => {
        expect(splitMessage("a".repeat(25), 10)).toEqual(["a".repeat(10), "a".repeat(10), "a".repeat(5)]);
    });

    it("keeps chunks within the limit when the text has word boundaries", () => {
        const text = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ");
        for (const part of splitMessage(text, 50)) {
            expect(part.length).toBeLessThanOrEqual(50);
        }
    });

    it("preserves the text apart from trimmed boundary whitespace", () => {
        const text = `${"a".repeat(8)} ${"b".repeat(8)} ${"c".repeat(8)}`;
        expect(splitMessage(text, 10).join(" ")).toBe(text);
    });
});
