import type { CreateReactionData, DeleteReactionData, FindReactionData, Reaction } from "@core/entities/Reaction.js";
import type { ReactionRepository } from "@core/repositories/ReactionRepository.js";
import type { DB } from "@db/types.js";
import type { Reactions } from "@db/types.js";
import type { Kysely, Selectable } from "kysely";

//Transform database reaction emote to domain reaction emote
export const transformReaction = (dbReaction: Selectable<Reactions> | Reactions): Reaction => {
    return {
        giverId: dbReaction.giver_id,
        receiverId: dbReaction.receiver_id,
        channelId: dbReaction.channel_id,
        messageId: dbReaction.message_id,
        emoteId: dbReaction.emote_id,
    };
};

//Factory function to create ReactionRepository instance
export const createReactionRepository = (db: Kysely<DB>): ReactionRepository => {
    const reactions = db.selectFrom("reactions").selectAll();

    const findReaction = async (data: FindReactionData): Promise<Reaction | null> => {
        const { giverId, receiverId, channelId, messageId, emoteId } = data;
        const reaction = await reactions.where("giver_id", "=", giverId).where("receiver_id", "=", receiverId).where("channel_id", "=", channelId).where("message_id", "=", messageId).where("emote_id", "=", emoteId).executeTakeFirst();
        return reaction ? transformReaction(reaction) : null;
    };

    const findReactionsForMessage = async (messageId: string): Promise<Reaction[]> => {
        const result = await reactions.where("message_id", "=", messageId).execute();
        return result.map(transformReaction);
    };

    const createReaction = async (data: CreateReactionData): Promise<Reaction> => {
        const ids = [data.giverId, data.receiverId, data.channelId, data.messageId];
        if (ids.some(i => !i || i === "0")) {
            throw new Error("Invalid id");
        }

        const existing = await findReaction(data);
        if (existing) {
            console.error(`Reaction exists, ignoring`, existing);
        }

        const { giverId, receiverId, channelId, messageId, emoteId } = data;
        const [reaction] = await db.insertInto("reactions").values({ giver_id: giverId, receiver_id: receiverId, channel_id: channelId, message_id: messageId, emote_id: emoteId }).returningAll().execute();

        if (!reaction) {
            throw new Error("Failed to create reaction");
        }

        return transformReaction(reaction);
    };

    const deleteReaction = async (data: DeleteReactionData): Promise<void> => {
        const { giverId, receiverId, channelId, messageId, emoteId } = data;

        const result = await db.deleteFrom("reactions").where("giver_id", "=", giverId).where("receiver_id", "=", receiverId).where("channel_id", "=", channelId).where("message_id", "=", messageId).where("emote_id", "=", emoteId).executeTakeFirst();

        if (result.numDeletedRows <= 0) {
            throw new Error("Failed to delete reaction, or it doesn't exist");
        }
    };

    const deleteReactionsForMessage = async (messageId: string): Promise<void> => {
        if (messageId === "" || messageId === "0") {
            throw new Error("Invalid message id");
        }

        const result = await db.deleteFrom("reactions").where("message_id", "=", messageId).executeTakeFirst();
        if (result.numDeletedRows <= 0) {
            throw new Error(`No messages with id ${messageId} to remove reactions from`);
        }
    };

    const deleteReactionsForEmote = async (messageId: string, emoteId: number): Promise<void> => {
        if (messageId === "" || emoteId === 0) {
            throw new Error("Invalid id");
        }

        const result = await db.deleteFrom("reactions").where("message_id", "=", messageId).where("emote_id", "=", emoteId).executeTakeFirst();
        if (result.numDeletedRows <= 0) {
            throw new Error(`No messages with id ${messageId} to remove reactions from`);
        }
    };

    return { find: findReaction, findForMessage: findReactionsForMessage, create: createReaction, delete: deleteReaction, deleteReactionsForMessage, deleteReactionsForEmote };
};
