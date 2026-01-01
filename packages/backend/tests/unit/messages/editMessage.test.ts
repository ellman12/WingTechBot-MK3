import { createMessageRepository } from "@adapters/repositories/MessageRepository.js";

import { createTestDb } from "../../utils/testUtils.js";

describe.concurrent("editMessage", () => {
    it("should update message content successfully", async () => {
        const db = await createTestDb();
        const repo = createMessageRepository(db);

        await db.insertInto("messages").values({ id: "m1", author_id: "a1", channel_id: "c1", content: "old" }).execute();

        const updated = await repo.edit({ id: "m1", content: "new" });
        expect(updated.id).toEqual("m1");
        expect(updated.content).toEqual("new");
        expect(updated.editedAt).not.toBeNull();
    });

    it("should throw if message does not exist", async () => {
        const db = await createTestDb();
        const repo = createMessageRepository(db);

        await expect(repo.edit({ id: "mX", content: "test" })).rejects.toThrow("Message does not exist");
    });
});
