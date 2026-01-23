import { transformReaction } from "@adapters/repositories/ReactionRepository.js";
import type { CreateMessageData, DeleteMessageData, EditMessageData, Message } from "@core/entities/Message.js";
import type { MessageRepository } from "@core/repositories/MessageRepository.js";
import type { DB, Messages, Reactions } from "@db/types.js";
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
            return existing;
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
        const { id, content, editedAt } = data;

        const existing = await findMessageById(id);
        if (!existing) {
            throw new Error("Message does not exist");
        }

        const updated = await db.updateTable("messages").set({ content, edited_at: editedAt }).where("id", "=", id).returningAll().executeTakeFirst();

        if (!updated) {
            throw new Error("Failed to update message");
        }

        return transformMessage(updated);
    };

    //Gets all messages (optionally filtered by year) and their reactions as an array.
    const getAllMessages = async (year?: number): Promise<Message[]> => {
        const result = await db
            .selectFrom("messages as m")
            .leftJoin("reactions", "reactions.message_id", "m.id")
            .select(["m.id", "m.author_id", "m.channel_id", "m.content", "m.referenced_message_id", "m.created_at", "m.edited_at", sql<Reactions[]>`COALESCE(JSON_AGG(reactions) FILTER (WHERE reactions.giver_id IS NOT NULL), '[]')`.as("reactions")])
            .groupBy("m.id")
            .orderBy("m.created_at")
            .$if(year !== undefined, qb => qb.where(sql`extract(year from ${sql.ref("m.created_at")})`, "=", year!))
            .execute();

        return result.map(m => transformMessage(m, m.reactions));
    };

    //Identical to getAllMessages but returns Map of messages with their ids for keys.
    const getAllMessagesAsMap = async (year?: number): Promise<Map<string, Message>> => {
        return new Map((await getAllMessages(year)).map(m => [m.id, m]));
    };

    //Gets all messages for a specific channel (optionally filtered by year) with their reactions
    const getMessagesForChannel = async (channelId: string, year?: number): Promise<Message[]> => {
        const result = await db
            .selectFrom("messages as m")
            .where("m.channel_id", "=", channelId)
            .leftJoin("reactions", "reactions.message_id", "m.id")
            .select(["m.id", "m.author_id", "m.channel_id", "m.content", "m.referenced_message_id", "m.created_at", "m.edited_at", sql<Reactions[]>`COALESCE(JSON_AGG(reactions) FILTER (WHERE reactions.giver_id IS NOT NULL), '[]')`.as("reactions")])
            .groupBy("m.id")
            .orderBy("m.created_at")
            .$if(year !== undefined, qb => qb.where(sql`extract(year from ${sql.ref("m.created_at")})`, "=", year!))
            .execute();

        return result.map(m => transformMessage(m, m.reactions));
    };

    const getNewestMessages = async (limit: number, channelId?: string, withinMinutes?: number): Promise<Message[]> => {
        const result = await db
            .selectFrom("messages as m")
            .leftJoin("reactions", "reactions.message_id", "m.id")
            .select(["m.id", "m.author_id", "m.channel_id", "m.content", "m.referenced_message_id", "m.created_at", "m.edited_at", sql<Reactions[]>`COALESCE(JSON_AGG(reactions) FILTER (WHERE reactions.giver_id IS NOT NULL), '[]')`.as("reactions")])
            .groupBy("m.id")
            .orderBy("m.created_at", "desc")
            .limit(limit)
            .$if(withinMinutes !== undefined, qb => qb.where("m.created_at", ">=", sql<Date>`NOW() - make_interval(mins => ${withinMinutes})`))
            .$if(channelId !== undefined, qb => qb.where("m.channel_id", "=", channelId!))
            .execute();

        return result.map(m => transformMessage(m, m.reactions));
    };

    const getUniqueAuthorIds = async (): Promise<string[]> => {
        const result = await db.selectFrom("messages").select("author_id").distinct().execute();
        return result.map(m => m.author_id);
    };

    const batchCreateMessages = async (messages: CreateMessageData[]): Promise<void> => {
        if (messages.length === 0) {
            return;
        }

        // Validate all messages
        for (const data of messages) {
            const { id, authorId, channelId, referencedMessageId } = data;
            const ids = [id, authorId, channelId];
            if (ids.some(i => !i || i === "0")) {
                throw new Error("Invalid id");
            }
            if (id === referencedMessageId) {
                throw new Error("id and referencedMessageId cannot be the same");
            }
        }

        // Batch insert with ON CONFLICT DO NOTHING to handle duplicates
        const values = messages.map(data => ({
            id: data.id,
            author_id: data.authorId,
            channel_id: data.channelId,
            content: data.content,
            referenced_message_id: data.referencedMessageId,
            created_at: data.createdAt,
            edited_at: data.editedAt,
        }));

        await db
            .insertInto("messages")
            .values(values)
            .onConflict(oc => oc.column("id").doNothing())
            .execute();
    };

    const batchUpdateMessages = async (messages: Array<{ id: string; content: string; editedAt: Date | null }>): Promise<void> => {
        if (messages.length === 0) {
            return;
        }

        // Use Kysely's query builder with a CTE to batch update all messages in a single query
        const values = messages.map(m => sql`(${m.id}, ${m.content}, ${m.editedAt})`);
        const valuesClause = sql.join(values, sql`, `);

        await db
            .with("updates(id, content, edited_at)", () => sql`VALUES ${valuesClause}`)
            .updateTable("messages")
            .from("updates")
            .set({
                content: sql.ref("updates.content"),
                edited_at: sql.ref("updates.edited_at"),
            })
            .whereRef("messages.id", "=", "updates.id")
            .execute();
    };

    return {
        findById: findMessageById,
        create: createMessage,
        delete: deleteMessage,
        edit: editMessage,
        getAllMessages,
        getAllMessagesAsMap,
        getMessagesForChannel,
        getNewestMessages,
        getUniqueAuthorIds,
        batchCreate: batchCreateMessages,
        batchUpdate: batchUpdateMessages,
    };
};
