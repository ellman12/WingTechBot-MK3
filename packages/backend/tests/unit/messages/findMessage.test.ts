import { createMessageRepository } from "@adapters/repositories/MessageRepository";

import { createTestDb } from "../../utils/testUtils";

describe("findMessage", () => {
    it("should return null when message not found", async () => {
        const db = await createTestDb();
        const repo = createMessageRepository(db);

        const result = await repo.find({ authorId: "a1", channelId: "c1", content: "hello" });
        expect(result).toBeNull();
    });

    it("should return a message when found", async () => {
        const db = await createTestDb();
        const repo = createMessageRepository(db);

        await db.insertInto("messages").values({ id: "m1", author_id: "a1", channel_id: "c1", content: "hello" }).execute();

        const result = await repo.find({ authorId: "a1", channelId: "c1", content: "hello" });
        expect(result).toEqual({ id: "m1", authorId: "a1", channelId: "c1", content: "hello" });
    });
});
