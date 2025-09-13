import type { CreateMessageData, DeleteMessageData, EditMessageData, FindMessageData, Message } from "@core/entities/Message";

export type MessageRepository = {
    find(data: FindMessageData): Promise<Message | null>;
    findById(id: string): Promise<Message | null>;
    create(data: CreateMessageData): Promise<Message>;
    delete(data: DeleteMessageData): Promise<Message>;
    edit(data: EditMessageData): Promise<Message>;
    getAllMessages(): Promise<Message[]>;
    getAllMessagesForYear(year: number): Promise<Message[]>;
};
