import { createMessageRepository } from "@adapters/repositories/MessageRepository";
import type { Message } from "@core/entities/Message";

import { createTestDb } from "../../utils/testUtils";

const sharedMessage: Message = { id: "m1", authorId: "a1", channelId: "c1", content: "hello", referencedMessageId: undefined, createdAt: new Date(), editedAt: null, reactions: [] };

describe.concurrent("findMessageById", () => {
    it("should return null when id not found", async () => {
        const db = await createTestDb();
        const repo = createMessageRepository(db);

        const result = await repo.findById("unknown");
        expect(result).toBeNull();
    });

    it("should return the message when id exists", async () => {
        const db = await createTestDb();
        const repo = createMessageRepository(db);

        const message = await repo.create(sharedMessage);
        const result = await repo.findById("m1");

        expect(result).toEqual(message);
    });
});
