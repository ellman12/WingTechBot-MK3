import type { CreateMessageData, DeleteMessageData, EditMessageData, FindMessageData, Message } from "@core/entities/Message";
import type { MessageRepository } from "@core/repositories/MessageRepository";
import type { DB, Messages } from "@db/types";
import { type Kysely, type Selectable, sql } from "kysely";

const transformMessage = (dbMessage: Selectable<Messages>): Message => {
    return {
        id: dbMessage.id,
        authorId: dbMessage.author_id,
        channelId: dbMessage.channel_id,
        content: dbMessage.content,
    };
};

export const createMessageRepository = (db: Kysely<DB>): MessageRepository => {
    const messages = db.selectFrom("messages").selectAll();

    const findMessage = async (data: FindMessageData): Promise<Message | null> => {
        const { authorId, channelId, content } = data;
        const message = await messages.where("author_id", "=", authorId).where("channel_id", "=", channelId).where("content", "=", content).executeTakeFirst();
        return message ? transformMessage(message) : null;
    };

    const findMessageById = async (id: string): Promise<Message | null> => {
        const message = await messages.where("id", "=", id).executeTakeFirst();
        return message ? transformMessage(message) : null;
    };

    const createMessage = async (data: CreateMessageData): Promise<Message> => {
        const { id, authorId, channelId, content } = data;
        const ids = [id, authorId, channelId];
        if (ids.some(i => !i || i === "0")) {
            throw new Error("Invalid id");
        }

        const existing = await findMessageById(id);
        if (existing) {
            throw new Error("Message exists");
        }

        const message = await db.insertInto("messages").values({ id, author_id: authorId, channel_id: channelId, content }).returningAll().executeTakeFirst();
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

        const updated = await db.updateTable("messages").set({ content }).where("id", "=", id).returningAll().executeTakeFirst();
        if (!updated) {
            throw new Error("Failed to update message");
        }

        return transformMessage(updated);
    };

    const getAllMessages = async (): Promise<Message[]> => {
        const result = await messages.execute();
        return result.map(transformMessage);
    };

    const getAllMessagesForYear = async (year: number): Promise<Message[]> => {
        const result = await db
            .selectFrom("messages")
            .where(sql`extract(year from ${sql.ref("created_at")})`, "=", year)
            .selectAll()
            .execute();
        return result.map(transformMessage);
    };

    return {
        findById: findMessageById,
        find: findMessage,
        create: createMessage,
        delete: deleteMessage,
        edit: editMessage,
        getAllMessages,
        getAllMessagesForYear,
    };
};
