import type { CreateMessageData, DeleteMessageData, EditMessageData, Message } from "@core/entities/Message";

export type MessageRepository = {
    findById(id: string): Promise<Message | null>;
    create(data: CreateMessageData): Promise<Message>;
    delete(data: DeleteMessageData): Promise<Message>;
    edit(data: EditMessageData): Promise<Message>;
    getAllMessages(year?: number): Promise<Message[]>;
    getAllMessagesAsMap(year?: number): Promise<Map<string, Message>>;
};
