import type { CreateMessageData, DeleteMessageData, EditMessageData, Message } from "@core/entities/Message.js";

export type MessageRepository = {
    findById(id: string): Promise<Message | null>;
    create(data: CreateMessageData): Promise<Message>;
    delete(data: DeleteMessageData): Promise<Message>;
    edit(data: EditMessageData): Promise<Message>;
    getAllMessages(year?: number): Promise<Message[]>;
    getAllMessagesAsMap(year?: number): Promise<Map<string, Message>>;
    getMessagesForChannel(channelId: string, year?: number): Promise<Message[]>;
    getNewestMessages(limit: number, channelId?: string): Promise<Message[]>;

    batchCreate(messages: CreateMessageData[]): Promise<void>;
    batchUpdate(messages: Array<{ id: string; content: string }>): Promise<void>;
};
