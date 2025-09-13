import { createMessageRepository } from "@adapters/repositories/MessageRepository";

import { createTestDb } from "../../utils/testUtils";

describe("createMessage", () => {
    it("should create a message successfully", async () => {
        const db = await createTestDb();
        const repo = createMessageRepository(db);

        const msg = await repo.create({ id: "m1", authorId: "a1", channelId: "c1", content: "hello" });
        expect(msg).toEqual({ id: "m1", authorId: "a1", channelId: "c1", content: "hello" });
    });

    it("should throw error if invalid authorId", async () => {
        const db = await createTestDb();
        const repo = createMessageRepository(db);

        await expect(repo.create({ id: "m1", authorId: "0", channelId: "c1", content: "msg" })).rejects.toThrow("Invalid id");
    });

    it("should throw error if invalid channelId", async () => {
        const db = await createTestDb();
        const repo = createMessageRepository(db);

        await expect(repo.create({ id: "m1", authorId: "a1", channelId: "", content: "msg" })).rejects.toThrow("Invalid id");
    });

    it("should throw error if message with same id already exists", async () => {
        const db = await createTestDb();
        const repo = createMessageRepository(db);

        await db.insertInto("messages").values({ id: "m1", author_id: "a1", channel_id: "c1", content: "dup" }).execute();
        await expect(repo.create({ id: "m1", authorId: "a2", channelId: "c2", content: "new" })).rejects.toThrow("Message exists");
    });
});
