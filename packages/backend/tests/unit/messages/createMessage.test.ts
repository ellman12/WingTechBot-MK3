import { createMessageRepository } from "@adapters/repositories/MessageRepository.js";
import type { Message } from "@core/entities/Message.js";

import { createTestDb } from "../../utils/testUtils.js";

const sharedMessage: Message = { id: "m1", authorId: "a1", channelId: "c1", content: "hello", referencedMessageId: undefined, createdAt: new Date(), editedAt: null, reactions: [] };

describe.concurrent("createMessage", () => {
    it("should create a message successfully", async () => {
        const db = await createTestDb();
        const repo = createMessageRepository(db);

        const msg = await repo.create(sharedMessage);
        expect(msg).toEqual(sharedMessage);
    });

    it("should throw error if invalid authorId", async () => {
        const db = await createTestDb();
        const repo = createMessageRepository(db);

        await expect(repo.create({ ...sharedMessage, authorId: "0" })).rejects.toThrow();
    });

    it("should throw error if invalid channelId", async () => {
        const db = await createTestDb();
        const repo = createMessageRepository(db);

        await expect(repo.create({ ...sharedMessage, channelId: "0" })).rejects.toThrow();
    });

    it("should throw error if message id and referenced message id are equal", async () => {
        const db = await createTestDb();
        const repo = createMessageRepository(db);

        await expect(repo.create({ ...sharedMessage, id: "m1", referencedMessageId: "m1" })).rejects.toThrow();
    });
});
