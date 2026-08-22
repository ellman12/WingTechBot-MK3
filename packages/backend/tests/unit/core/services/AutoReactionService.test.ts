import type { Config } from "@core/config/Config.js";
import type { LlmInstructionRepository } from "@core/ports/repositories/LlmInstructionRepository.js";
import type { LlmService } from "@core/ports/services/LlmService.js";
import { type AutoReactionService, createAutoReactionService, reactionScoldMessages } from "@core/services/AutoReactionService.js";
import { describe, expect, it, vi } from "vitest";

import { getTestConfig } from "../../../setup.js";

const baseConfig = getTestConfig();
const botId = baseConfig.discord.clientId;

//Every rule is on a 1-in-N chance; setting a denominator to 0 disables the rule and 1 makes it always fire.
const configWith = (overrides: Partial<Config["autoReaction"]>, llmDisabled = true): Config => ({
    ...baseConfig,
    llm: { ...baseConfig.llm, disabled: llmDisabled },
    autoReaction: {
        funnySubstringsProbability: 0,
        erJokeProbability: 0,
        nekoizeProbability: 0,
        elliottReminderProbability: 0,
        ...overrides,
    },
});

const llmInstructionRepo = (instruction = "nekoize instruction"): LlmInstructionRepository => ({
    getInstruction: vi.fn(async () => instruction),
    getInstructionPath: vi.fn(),
    instructionExists: vi.fn(),
    validateInstructions: vi.fn(),
});

const stubLlmService = (reply = "nya~"): LlmService => ({ generateReply: vi.fn(async () => reply), generateStandaloneMessage: vi.fn(async () => reply) });

const createService = (config: Config, llmService: LlmService = stubLlmService(), instructionRepo = llmInstructionRepo()): AutoReactionService => createAutoReactionService({ config, llmService, llmInstructionRepo: instructionRepo });

//Feeds the rules plain data. getCleanedContent is the identity unless a test needs the mention-cleaned form to differ.
const messageFrom = (content: string, options: { authorId?: string; authorName?: string; cleanedContent?: string; onLlmStart?: () => void } = {}) => ({
    authorId: options.authorId ?? "user-id",
    authorName: options.authorName ?? "Test User",
    content,
    getCleanedContent: async () => options.cleanedContent ?? content,
    onLlmStart: options.onLlmStart,
});

describe("AutoReactionService - Elliott reminder", () => {
    const service = createService(configWith({ elliottReminderProbability: 1 }));

    it("corrects 'Eliot' (missing L and T, title case)", async () => {
        const result = await service.evaluateMessage(messageFrom("Eliot is here"));

        expect(result?.content).toBeTruthy();
        expect(result!.content).toContain("**l**");
        expect(result!.content).toContain("**t**");
        expect(result!.content).toMatch(/El\*\*l\*\*iot\*\*t\*\*/i);
    });

    it("corrects 'ELIOT' (missing L and T, uppercase)", async () => {
        const result = await service.evaluateMessage(messageFrom("ELIOT was there"));

        expect(result!.content).toContain("**L**");
        expect(result!.content).toContain("**T**");
        expect(result!.content).toMatch(/EL\*\*L\*\*IOT\*\*T\*\*/i);
    });

    it("corrects 'eliott' (missing L only)", async () => {
        const result = await service.evaluateMessage(messageFrom("eliott is correct except for the l"));

        expect(result!.content).toContain("**l**");
        expect(result!.content).not.toContain("**t**");
        expect(result!.content).toMatch(/el\*\*l\*\*iott/i);
    });

    it("corrects 'Eliott' (missing L only, title case)", async () => {
        const result = await service.evaluateMessage(messageFrom("Eliott needs another l"));

        expect(result!.content).toContain("**l**");
        expect(result!.content).not.toContain("**t**");
        expect(result!.content).toMatch(/El\*\*l\*\*iott/i);
    });

    it("corrects 'elliot' (missing T only)", async () => {
        const result = await service.evaluateMessage(messageFrom("elliot is missing a t"));

        expect(result!.content).not.toContain("**l**");
        expect(result!.content).toContain("**t**");
        expect(result!.content).toMatch(/elliot\*\*t\*\*/i);
    });

    it("quotes the matched text", async () => {
        const result = await service.evaluateMessage(messageFrom("Eliot is here"));
        expect(result!.content.startsWith("> ")).toBe(true);
    });

    it("does not react to its own messages", async () => {
        expect(await service.evaluateMessage(messageFrom("elliot test", { authorId: botId }))).toBeNull();
    });

    it("does not react when there is no misspelling", async () => {
        expect(await service.evaluateMessage(messageFrom("This is a normal message"))).toBeNull();
    });

    it("does not react to the correct spelling 'Elliott'", async () => {
        expect(await service.evaluateMessage(messageFrom("Elliott is spelled correctly"))).toBeNull();
    });
});

describe("AutoReactionService - 'er joke", () => {
    const service = createService(configWith({ erJokeProbability: 1 }));

    it("jokes about the last word ending in er", async () => {
        const result = await service.evaluateMessage(messageFrom("I hit it with a hammer"));
        expect(result).toEqual({ kind: "reply", content: `"hammer"? I hardly even know 'er!` });
    });

    it("strips trailing punctuation", async () => {
        const result = await service.evaluateMessage(messageFrom("that was a banger!"));
        expect(result!.content).toBe(`"banger"? I hardly even know 'er!`);
    });

    it("ignores short words", async () => {
        expect(await service.evaluateMessage(messageFrom("her"))).toBeNull();
    });

    it("ignores words that don't end in er", async () => {
        expect(await service.evaluateMessage(messageFrom("hello there world"))).toBeNull();
    });

    it("does not react to its own messages", async () => {
        expect(await service.evaluateMessage(messageFrom("hammer", { authorId: botId }))).toBeNull();
    });
});

describe("AutoReactionService - funny substrings", () => {
    const service = createService(configWith({ funnySubstringsProbability: 1 }));

    it("highlights 69", async () => {
        const result = await service.evaluateMessage(messageFrom("it costs 69 dollars"));
        expect(result!.content).toContain("**69**");
        expect(result!.content.endsWith("\nNice")).toBe(true);
    });

    it("highlights 420", async () => {
        const result = await service.evaluateMessage(messageFrom("blaze it 420 style"));
        expect(result!.content).toContain("**420**");
    });

    it("highlights 69420", async () => {
        const result = await service.evaluateMessage(messageFrom("the score was 69420"));
        expect(result!.content).toContain("**69420**");
    });

    it("uses the mention-cleaned content", async () => {
        const result = await service.evaluateMessage(messageFrom("<@123> what a number", { cleanedContent: "Elliott 69 what a number" }));
        expect(result!.content).toContain("**69**");
    });

    it("strips custom emote ids before matching", async () => {
        const result = await service.evaluateMessage(messageFrom("<:sixtynine:420>"));
        expect(result).toBeNull();
    });

    it("ignores messages without a funny substring", async () => {
        expect(await service.evaluateMessage(messageFrom("nothing funny here"))).toBeNull();
    });

    it("does not react to its own messages", async () => {
        expect(await service.evaluateMessage(messageFrom("69", { authorId: botId }))).toBeNull();
    });
});

describe("AutoReactionService - nekoize", () => {
    it("replies with the LLM response and flags it as an LLM reply", async () => {
        const llmService = stubLlmService("hewwo nya~");
        const instructionRepo = llmInstructionRepo();
        const service = createService(configWith({ nekoizeProbability: 1 }, false), llmService, instructionRepo);

        const result = await service.evaluateMessage(messageFrom("<@123> hello", { cleanedContent: "Elliott hello" }));

        expect(result).toEqual({ kind: "reply", content: "hewwo nya~", usesLlm: true });
        expect(instructionRepo.getInstruction).toHaveBeenCalledWith("nekoize");
        expect(llmService.generateReply).toHaveBeenCalledWith({ prompt: { role: "user", authorName: "Test User", content: "Elliott hello" }, systemInstruction: "nekoize instruction" });
    });

    it("signals the caller before the LLM request so it can show a typing indicator", async () => {
        const service = createService(configWith({ nekoizeProbability: 1 }, false));
        const onLlmStart = vi.fn();

        await service.evaluateMessage(messageFrom("hello", { onLlmStart }));

        expect(onLlmStart).toHaveBeenCalledOnce();
    });

    it("does nothing when the LLM is disabled", async () => {
        const llmService = stubLlmService();
        const service = createService(configWith({ nekoizeProbability: 1 }, true), llmService);

        expect(await service.evaluateMessage(messageFrom("hello"))).toBeNull();
        expect(llmService.generateReply).not.toHaveBeenCalled();
    });

    it("does not react to its own messages", async () => {
        const service = createService(configWith({ nekoizeProbability: 1 }, false));
        expect(await service.evaluateMessage(messageFrom("hello", { authorId: botId }))).toBeNull();
    });
});

describe("AutoReactionService - rule ordering", () => {
    it("returns the first rule that fires", async () => {
        const service = createService(configWith({ erJokeProbability: 1, elliottReminderProbability: 1 }));

        //Both rules match; the 'er joke comes first in the table.
        const result = await service.evaluateMessage(messageFrom("eliot is a hammer"));

        expect(result!.content).toBe(`"hammer"? I hardly even know 'er!`);
    });

    it("falls through to a later rule when the earlier one does not match", async () => {
        const service = createService(configWith({ erJokeProbability: 1, elliottReminderProbability: 1 }));

        const result = await service.evaluateMessage(messageFrom("eliot is here"));

        expect(result!.content).toContain("**l**");
    });

    it("returns null when no rule is enabled", async () => {
        const service = createService(configWith({}));
        expect(await service.evaluateMessage(messageFrom("eliot is a hammer 69"))).toBeNull();
    });
});

describe("AutoReactionService - self-reaction scolds", () => {
    const service = createService(configWith({}));

    it("returns a scold from the list for the emote", () => {
        const scold = service.getSelfReactionScold({ authorId: "user-1", reactorId: "user-1", emoteName: "upvote" });
        expect(reactionScoldMessages["upvote"]).toContain(scold);
    });

    it("scolds self-awards", () => {
        for (const emote of ["silver", "gold", "platinum"]) {
            const scold = service.getSelfReactionScold({ authorId: "user-1", reactorId: "user-1", emoteName: emote });
            expect(reactionScoldMessages[emote]).toContain(scold);
        }
    });

    it("returns null when the reactor is not the author", () => {
        vi.spyOn(console, "log").mockImplementation(() => {});
        expect(service.getSelfReactionScold({ authorId: "user-1", reactorId: "user-2", emoteName: "upvote" })).toBeNull();
    });

    it("returns null for an emote with no scolds", () => {
        expect(service.getSelfReactionScold({ authorId: "user-1", reactorId: "user-1", emoteName: "thumbsup" })).toBeNull();
    });

    it("returns null when the emote has no name", () => {
        expect(service.getSelfReactionScold({ authorId: "user-1", reactorId: "user-1", emoteName: null })).toBeNull();
    });
});
