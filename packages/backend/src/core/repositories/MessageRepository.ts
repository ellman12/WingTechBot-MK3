import type { CreateMessageData, DeleteMessageData, EditMessageData, Message } from "@core/entities/Message";

export type MessageRepository = {
    findById(id: string): Promise<Message | null>;
    create(data: CreateMessageData): Promise<Message>;
    delete(data: DeleteMessageData): Promise<Message>;
    edit(data: EditMessageData): Promise<Message>;
    getAllMessages(): Promise<Message[]>;
    getAllMessagesForYear(year: number): Promise<Message[]>;
};
