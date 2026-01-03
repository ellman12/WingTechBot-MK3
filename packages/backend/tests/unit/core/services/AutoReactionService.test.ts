import type { LlmInstructionRepository } from "@adapters/repositories/LlmInstructionRepository.js";
import { createAutoReactionService } from "@core/services/AutoReactionService.js";
import type { DiscordChatService } from "@core/services/DiscordChatService.js";
import type { GeminiLlmService } from "@infrastructure/services/GeminiLlmService.js";
import type { Message, OmitPartialGroupDMChannel, TextChannel } from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTestConfig } from "../../../setup.js";

function createMockMessage(overrides: { authorId?: string; content?: string } = {}): Message {
    const mockChannel: TextChannel = {
        id: "channel-id",
        send: vi.fn(),
    } as unknown as TextChannel;

    const replyFn = vi.fn(async () => {
        const replyMessage = createMockMessage({ authorId: "bot-id", content: "" });
        return replyMessage as unknown as OmitPartialGroupDMChannel<Message<boolean>>;
    });

    // Mock Message object with only the properties used by AutoReactionService
    // Discord.js Message is a complex class with 60+ properties, so we create a minimal mock
    const mockMessage = {
        id: "message-id",
        author: { id: overrides.authorId ?? "user-id" },
        content: overrides.content ?? "",
        channel: mockChannel,
        reply: replyFn,
    };

    return mockMessage as unknown as Message;
}

describe("AutoReactionService - Elliott Reminder", () => {
    let autoReactionService: ReturnType<typeof createAutoReactionService>;
    let mockMessage: Message;
    let replyContent: string | null = null;

    const mockConfig = {
        ...getTestConfig(),
        autoReaction: {
            ...getTestConfig().autoReaction,
            funnySubstringsProbability: 0, // Disable to avoid conflicts
            erJokeProbability: 0, // Disable to avoid conflicts
            nekoizeProbability: 0, // Disable to avoid conflicts
            elliottReminderProbability: 1, // Always trigger for testing
        },
    };

    const mockDiscordChatService: DiscordChatService = {
        hasBeenPinged: vi.fn(),
        replaceUserAndRoleMentions: vi.fn(),
        sendTypingIndicator: vi.fn(),
        formatMessageContent: vi.fn(),
        sendMessage: vi.fn(),
        replyToInteraction: vi.fn(),
        followUpToInteraction: vi.fn(),
    };

    const mockGeminiLlmService: GeminiLlmService = {
        generateMessage: vi.fn(),
    };

    const mockLlmInstructionRepo: LlmInstructionRepository = {
        getInstruction: vi.fn(),
        getInstructionPath: vi.fn(),
        instructionExists: vi.fn(),
        validateInstructions: vi.fn(),
    };

    beforeEach(() => {
        replyContent = null;
        mockMessage = createMockMessage();

        vi.mocked(mockMessage.reply).mockImplementation(async options => {
            const content = typeof options === "string" ? options : typeof options === "object" && "content" in options ? String(options.content) : "";
            replyContent = content;
            const replyMessage = createMockMessage({ authorId: "bot-id", content });
            return replyMessage as unknown as OmitPartialGroupDMChannel<Message<boolean>>;
        });

        autoReactionService = createAutoReactionService({
            config: mockConfig,
            discordChatService: mockDiscordChatService,
            geminiLlmService: mockGeminiLlmService,
            llmInstructionRepo: mockLlmInstructionRepo,
        });
    });

    it("should correct 'Eliot' (missing L and T, title case)", async () => {
        mockMessage = createMockMessage({ content: "Eliot is here" });
        vi.mocked(mockMessage.reply).mockImplementation(async options => {
            const content = typeof options === "string" ? options : typeof options === "object" && "content" in options ? String(options.content) : "";
            replyContent = content;
            const replyMessage = createMockMessage({ authorId: "bot-id", content });
            return replyMessage as unknown as OmitPartialGroupDMChannel<Message<boolean>>;
        });
        await autoReactionService.messageCreated(mockMessage);

        expect(replyContent).toBeTruthy();
        expect(replyContent).toContain("**l**");
        expect(replyContent).toContain("**t**");
        expect(replyContent).toMatch(/El\*\*l\*\*iot\*\*t\*\*/i);
    });

    it("should correct 'ELIOT' (missing L and T, uppercase)", async () => {
        mockMessage = createMockMessage({ content: "ELIOT was there" });
        vi.mocked(mockMessage.reply).mockImplementation(async options => {
            const content = typeof options === "string" ? options : typeof options === "object" && "content" in options ? String(options.content) : "";
            replyContent = content;
            const replyMessage = createMockMessage({ authorId: "bot-id", content });
            return replyMessage as unknown as OmitPartialGroupDMChannel<Message<boolean>>;
        });
        await autoReactionService.messageCreated(mockMessage);

        expect(replyContent).toBeTruthy();
        expect(replyContent).toContain("**L**");
        expect(replyContent).toContain("**T**");
        expect(replyContent).toMatch(/EL\*\*L\*\*IOT\*\*T\*\*/i);
    });

    it("should correct 'eliott' (missing L only)", async () => {
        mockMessage = createMockMessage({ content: "eliott is correct except for the l" });
        vi.mocked(mockMessage.reply).mockImplementation(async options => {
            const content = typeof options === "string" ? options : typeof options === "object" && "content" in options ? String(options.content) : "";
            replyContent = content;
            const replyMessage = createMockMessage({ authorId: "bot-id", content });
            return replyMessage as unknown as OmitPartialGroupDMChannel<Message<boolean>>;
        });
        await autoReactionService.messageCreated(mockMessage);

        expect(replyContent).toBeTruthy();
        expect(replyContent).toContain("**l**");
        expect(replyContent).not.toContain("**t**");
        expect(replyContent).toMatch(/el\*\*l\*\*iott/i);
    });

    it("should correct 'Eliott' (missing L only, title case)", async () => {
        mockMessage = createMockMessage({ content: "Eliott needs another l" });
        vi.mocked(mockMessage.reply).mockImplementation(async options => {
            const content = typeof options === "string" ? options : typeof options === "object" && "content" in options ? String(options.content) : "";
            replyContent = content;
            const replyMessage = createMockMessage({ authorId: "bot-id", content });
            return replyMessage as unknown as OmitPartialGroupDMChannel<Message<boolean>>;
        });
        await autoReactionService.messageCreated(mockMessage);

        expect(replyContent).toBeTruthy();
        expect(replyContent).toContain("**l**");
        expect(replyContent).not.toContain("**t**");
        expect(replyContent).toMatch(/El\*\*l\*\*iott/i);
    });

    it("should correct 'elliot' (missing T only)", async () => {
        mockMessage = createMockMessage({ content: "elliot is missing a t" });
        vi.mocked(mockMessage.reply).mockImplementation(async options => {
            const content = typeof options === "string" ? options : typeof options === "object" && "content" in options ? String(options.content) : "";
            replyContent = content;
            const replyMessage = createMockMessage({ authorId: "bot-id", content });
            return replyMessage as unknown as OmitPartialGroupDMChannel<Message<boolean>>;
        });
        await autoReactionService.messageCreated(mockMessage);

        expect(replyContent).toBeTruthy();
        expect(replyContent).not.toContain("**l**");
        expect(replyContent).toContain("**t**");
        expect(replyContent).toMatch(/elliot\*\*t\*\*/i);
    });

    it("should not react to messages from the bot itself", async () => {
        mockMessage = createMockMessage({ authorId: "bot-id", content: "elliot test" });
        await autoReactionService.messageCreated(mockMessage);

        expect(replyContent).toBeNull();
    });

    it("should not react if message doesn't contain misspelling", async () => {
        mockMessage = createMockMessage({ content: "This is a normal message" });
        await autoReactionService.messageCreated(mockMessage);

        expect(replyContent).toBeNull();
    });

    it("should not react to correct spelling 'Elliott'", async () => {
        mockMessage = createMockMessage({ content: "Elliott is spelled correctly" });
        await autoReactionService.messageCreated(mockMessage);

        expect(replyContent).toBeNull();
    });
});
