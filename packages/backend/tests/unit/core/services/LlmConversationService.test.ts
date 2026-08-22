import type { Message } from "@core/entities/Message.js";
import { LlmUnavailableError } from "@core/errors/LlmErrors.js";
import type { LlmInstructionRepository } from "@core/ports/repositories/LlmInstructionRepository.js";
import type { MessageRepository } from "@core/ports/repositories/MessageRepository.js";
import type { LlmReplyInput, LlmService } from "@core/ports/services/LlmService.js";
import { createLlmConversationService } from "@core/services/LlmConversationService.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTestConfig } from "../../../setup.js";

const config = getTestConfig();
const botId = config.discord.clientId;

const message = (id: string, authorId = "author-1"): Message => ({
    id,
    authorId,
    channelId: "channel-1",
    content: `content ${id}`,
    createdAt: new Date(),
    editedAt: null,
    reactions: [],
});

const respondInput = (overrides: Partial<Parameters<ReturnType<typeof createLlmConversationService>["respond"]>[0]> = {}) => ({
    channelId: "channel-1",
    messageId: "trigger",
    authorId: "author-1",
    authorName: "Author One",
    content: "hello bot",
    resolveAuthorNames: vi.fn(async (ids: string[]) => new Map(ids.map(id => [id, `Name ${id}`]))),
    ...overrides,
});

describe("LlmConversationService", () => {
    let messageRepository: MessageRepository;
    let llmService: LlmService;
    let llmInstructionRepo: LlmInstructionRepository;
    let service: ReturnType<typeof createLlmConversationService>;

    const replyInput = () => vi.mocked(llmService.generateReply).mock.calls[0]![0] as LlmReplyInput;

    beforeEach(() => {
        messageRepository = {
            getNewestMessages: vi.fn(async () => [message("1"), message("2", botId), message("trigger")]),
        } as unknown as MessageRepository;

        llmService = { generateReply: vi.fn(async () => "llm response"), generateStandaloneMessage: vi.fn(async () => "") };

        llmInstructionRepo = {
            getInstruction: vi.fn(async () => "general chat instruction"),
            getInstructionPath: vi.fn(),
            instructionExists: vi.fn(),
            validateInstructions: vi.fn(),
        };

        service = createLlmConversationService({ config, messageRepository, llmService, llmInstructionRepo });
    });

    it("returns the LLM response", async () => {
        expect(await service.respond(respondInput())).toBe("llm response");
    });

    it("asks for the 10 newest messages in the channel from the last 15 minutes", async () => {
        await service.respond(respondInput());
        expect(messageRepository.getNewestMessages).toHaveBeenCalledWith(10, "channel-1", 15);
    });

    it("excludes the triggering message from the history", async () => {
        await service.respond(respondInput());
        expect(replyInput().history?.map(t => t.content)).toEqual(["content 1", "content 2"]);
    });

    it("attributes user turns to their authors and leaves the bot's turns unattributed", async () => {
        await service.respond(respondInput());

        expect(replyInput().history).toEqual([
            { role: "user", content: "content 1", authorName: "Name author-1" },
            { role: "model", content: "content 2" },
        ]);
    });

    it("only resolves names for the non-bot authors", async () => {
        const input = respondInput();
        await service.respond(input);
        expect(input.resolveAuthorNames).toHaveBeenCalledWith(["author-1"]);
    });

    it("sends the message as an attributed user prompt", async () => {
        await service.respond(respondInput());
        expect(replyInput().prompt).toEqual({ role: "user", content: "hello bot", authorName: "Name author-1" });
    });

    it("falls back to the supplied author name when the id could not be resolved", async () => {
        const input = respondInput({ authorId: "unknown", resolveAuthorNames: vi.fn(async () => new Map<string, string>()) });
        await service.respond(input);
        expect(replyInput().prompt.authorName).toBe("Author One");
    });

    it("falls back to a placeholder name for unresolved history authors", async () => {
        const input = respondInput({ resolveAuthorNames: vi.fn(async () => new Map<string, string>()) });
        await service.respond(input);
        expect(replyInput().history?.[0]?.authorName).toBe("User author-1");
    });

    it("uses the generalChat instruction", async () => {
        await service.respond(respondInput());
        expect(llmInstructionRepo.getInstruction).toHaveBeenCalledWith("generalChat");
        expect(replyInput().systemInstruction).toBe("general chat instruction");
    });

    it("still responds when fetching previous messages fails", async () => {
        vi.mocked(messageRepository.getNewestMessages).mockRejectedValueOnce(new Error("db down"));
        vi.spyOn(console, "error").mockImplementation(() => {});

        expect(await service.respond(respondInput())).toBe("llm response");
        expect(replyInput().history).toEqual([]);
    });

    it("propagates LlmUnavailableError", async () => {
        vi.mocked(llmService.generateReply).mockRejectedValueOnce(new LlmUnavailableError("rate limited"));
        await expect(service.respond(respondInput())).rejects.toBeInstanceOf(LlmUnavailableError);
    });
});
