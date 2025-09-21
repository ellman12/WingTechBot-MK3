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

    //Gets all messages and their reactions as an array.
    const getAllMessages = async (): Promise<Message[]> => {
        const result = await db
            .selectFrom("messages")
            .leftJoin("reactions", "reactions.message_id", "messages.id")
            .select([
                "messages.id",
                "messages.author_id",
                "messages.channel_id",
                "messages.content",
                "messages.referenced_message_id",
                "messages.created_at",
                "messages.edited_at",
                sql<Reactions[]>`COALESCE(JSON_AGG(reactions) FILTER (WHERE reactions.id IS NOT NULL), '[]')`.as("reactions"),
            ])
            .groupBy("messages.id")
            .orderBy("messages.created_at")
            .execute();

        return result.map(m => transformMessage(m, m.reactions));
    };

    //Gets all messages for a year and their reactions as an array.
    const getAllMessagesForYear = async (year: number): Promise<Message[]> => {
        const result = await db
            .selectFrom("messages")
            .where(sql`extract(year from ${sql.ref("created_at")})`, "=", year)
            .leftJoin("reactions", "reactions.message_id", "messages.id")
            .select([
                "messages.id",
                "messages.author_id",
                "messages.channel_id",
                "messages.content",
                "messages.referenced_message_id",
                "messages.created_at",
                "messages.edited_at",
                sql<Reactions[]>`COALESCE(JSON_AGG(reactions) FILTER (WHERE reactions.id IS NOT NULL), '[]')`.as("reactions"),
            ])
            .groupBy("messages.id")
            .orderBy("messages.created_at")
            .execute();

        return result.map(m => transformMessage(m, m.reactions));
    };

    return {
        findById: findMessageById,
        create: createMessage,
        delete: deleteMessage,
        edit: editMessage,
        getAllMessages,
        getAllMessagesForYear,
    };
};
