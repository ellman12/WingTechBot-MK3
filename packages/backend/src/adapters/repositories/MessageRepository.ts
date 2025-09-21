import { transformReaction } from "@adapters/repositories/ReactionRepository";
import type { CreateMessageData, DeleteMessageData, EditMessageData, Message } from "@core/entities/Message";
import type { MessageRepository } from "@core/repositories/MessageRepository";
import type { DB, Messages, Reactions } from "@db/types";
import { type Kysely, type Selectable, sql } from "kysely";

const transformMessage = (dbMessage: Selectable<Messages>, reactions?: Reactions[]): Message => {
    return {
        id: dbMessage.id,
        authorId: dbMessage.author_id,
        channelId: dbMessage.channel_id,
        content: dbMessage.content,
        referencedMessageId: dbMessage.referenced_message_id ?? undefined,
        createdAt: dbMessage.created_at,
        editedAt: dbMessage.edited_at,
        reactions: reactions?.map(transformReaction) ?? [],
    };
};

export const createMessageRepository = (db: Kysely<DB>): MessageRepository => {
    const messages = db.selectFrom("messages").selectAll();

    const findMessageById = async (id: string): Promise<Message | null> => {
        const message = await messages.where("id", "=", id).executeTakeFirst();
        return message ? transformMessage(message) : null;
    };

    const createMessage = async (data: CreateMessageData): Promise<Message> => {
        const { id, authorId, channelId, content, referencedMessageId, createdAt, editedAt } = data;
        const ids = [id, authorId, channelId];
        if (ids.some(i => !i || i === "0")) {
            throw new Error("Invalid id");
        }

        if (id === referencedMessageId) {
            throw new Error("id and referencedMessageId cannot be the same");
        }

        const existing = await findMessageById(id);
        if (existing) {
            throw new Error("Message exists");
        }

        const values = { id, author_id: authorId, channel_id: channelId, content, referenced_message_id: referencedMessageId, created_at: createdAt, edited_at: editedAt };
        const message = await db.insertInto("messages").values(values).returningAll().executeTakeFirst();
        if (!message) {
            throw new Error("Failed to create message");
        }

        return transformMessage(message);
    };

    const deleteMessage = async (data: DeleteMessageData): Promise<Message> => {
        const { id } = data;
        const message = await findMessageById(id);
        if (!message) {
            throw new Error("Message does not exist");
        }

        const result = await db.deleteFrom("messages").where("id", "=", id).executeTakeFirst();
        if (result.numDeletedRows <= 0) {
            throw new Error("Failed to delete message");
        }

        return message;
    };

    const editMessage = async (data: EditMessageData): Promise<Message> => {
        const { id, content } = data;

        const existing = await findMessageById(id);
        if (!existing) {
            throw new Error("Message does not exist");
        }

        const updated = await db.updateTable("messages").set({ content, edited_at: new Date() }).where("id", "=", id).returningAll().executeTakeFirst();

        if (!updated) {
            throw new Error("Failed to update message");
        }

        return transformMessage(updated);
    };

    //Gets all messages (optionally filtered by year) and their reactions as an array.
    const getAllMessages = async (year?: number): Promise<Message[]> => {
        let query = db
            .selectFrom("messages as m")
            .leftJoin("reactions", "reactions.message_id", "m.id")
            .select(["m.id", "m.author_id", "m.channel_id", "m.content", "m.referenced_message_id", "m.created_at", "m.edited_at", sql<Reactions[]>`COALESCE(JSON_AGG(reactions) FILTER (WHERE reactions.id IS NOT NULL), '[]')`.as("reactions")])
            .groupBy("m.id")
            .orderBy("m.created_at");

        if (year !== undefined) {
            query = query.where(sql`extract(year from ${sql.ref("m.created_at")})`, "=", year);
        }

        const result = await query.execute();
        return result.map(m => transformMessage(m, m.reactions));
    };

    //Identical to getAllMessages but returns Map of messages with their ids for keys.
    const getAllMessagesAsMap = async (year?: number): Promise<Map<string, Message>> => {
        return new Map((await getAllMessages(year)).map(m => [m.id, m]));
    };

    return {
        findById: findMessageById,
        create: createMessage,
        delete: deleteMessage,
        edit: editMessage,
        getAllMessages,
        getAllMessagesAsMap,
    };
};
