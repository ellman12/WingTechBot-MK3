import { createMessageRepository } from "@adapters/repositories/MessageRepository";

import { createTestDb } from "../../utils/testUtils";

describe("editMessage", () => {
    it("should update message content successfully", async () => {
        const db = await createTestDb();
        const repo = createMessageRepository(db);

        await db.insertInto("messages").values({ id: "m1", author_id: "a1", channel_id: "c1", content: "old" }).execute();

        const updated = await repo.edit({ id: "m1", content: "new" });
        expect(updated).toEqual({ id: "m1", authorId: "a1", channelId: "c1", content: "new" });
    });

    it("should throw if message does not exist", async () => {
        const db = await createTestDb();
        const repo = createMessageRepository(db);

        await expect(repo.edit({ id: "mX", content: "test" })).rejects.toThrow("Message does not exist");
    });
});
