import { createMessageRepository } from "@adapters/repositories/MessageRepository";

import { createTestDb } from "../../utils/testUtils";
import { createReactionRepository } from "@adapters/repositories/ReactionRepository";
import { createReactionEmoteRepository } from "@adapters/repositories/ReactionEmoteRepository";

describe("deleteMessage", () => {
    it("should delete a message successfully", async () => {
        const db = await createTestDb();
        const repo = createMessageRepository(db);

        await db.insertInto("messages").values({ id: "m1", author_id: "a1", channel_id: "c1", content: "bye" }).execute();
        let check = await repo.findById("m1");
        expect(check).not.toBeNull();

        const result = await repo.delete({ id: "m1" });
        expect(result).toEqual({ id: "m1", authorId: "a1", channelId: "c1", content: "bye" });

        check = await repo.findById("m1");
        expect(check).toBeNull();
    });

    it("should delete a message and its reactions", async () => {
        const db = await createTestDb();
        const messages = createMessageRepository(db);
        const reactions = createReactionRepository(db);
        const emotes = createReactionEmoteRepository(db);

        await db.insertInto("messages").values({ id: "m1", author_id: "a1", channel_id: "c1", content: "bye" }).execute();

        const emote1 = await emotes.findOrCreate("👀", null);
        const emote2 = await emotes.findOrCreate("upvote", "123456");
        await reactions.create({ giverId: "123", receiverId: "a1", channelId: "c1", messageId: "m1", emoteId: emote1.id });
        await reactions.create({ giverId: "123", receiverId: "a1", channelId: "c1", messageId: "m1", emoteId: emote2.id });

        expect(await db.selectFrom("reactions").selectAll().where("message_id", "=", "m1").execute()).toHaveLength(2);

        await messages.delete({ id: "m1" });
        const checkMsg = await messages.findById("m1");
        expect(checkMsg).toBeNull();

        expect(await db.selectFrom("reactions").selectAll().where("message_id", "=", "m1").execute()).toHaveLength(0);
    });

    it("should throw if message not found", async () => {
        const db = await createTestDb();
        const repo = createMessageRepository(db);

        await expect(repo.delete({ id: "mX" })).rejects.toThrow("Message does not exist");
    });
});
