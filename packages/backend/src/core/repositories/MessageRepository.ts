import type { CreateMessageData, DeleteMessageData, EditMessageData, Message } from "@core/entities/Message.js";

export type MessageRepository = {
    findById(id: string): Promise<Message | null>;
    create(data: CreateMessageData): Promise<Message>;
    delete(data: DeleteMessageData): Promise<Message>;
    edit(data: EditMessageData): Promise<Message>;
    getAllMessages(year?: number): Promise<Message[]>;
    getMessagesForChannel(channelId: string, year?: number): Promise<Message[]>;
    getNewestMessages(limit: number, channelId?: string, withinMinutes?: number): Promise<Message[]>;
    getUniqueAuthorIds(): Promise<string[]>;

    batchCreate(messages: CreateMessageData[]): Promise<void>;
    batchUpdate(messages: Array<{ id: string; content: string; editedAt: Date | null }>): Promise<void>;
};
