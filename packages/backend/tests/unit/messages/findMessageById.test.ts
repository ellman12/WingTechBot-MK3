import { createMessageRepository } from "@adapters/repositories/MessageRepository";

import { createTestDb } from "../../utils/testUtils";

describe("findMessageById", () => {
    it("should return null when id not found", async () => {
        const db = await createTestDb();
        const repo = createMessageRepository(db);

        const result = await repo.findById("unknown");
        expect(result).toBeNull();
    });

    it("should return the message when id exists", async () => {
        const db = await createTestDb();
        const repo = createMessageRepository(db);

        await db.insertInto("messages").values({ id: "m1", author_id: "a1", channel_id: "c1", content: "msg" }).execute();
        const result = await repo.findById("m1");

        expect(result).toEqual({ id: "m1", authorId: "a1", channelId: "c1", content: "msg" });
    });
});
