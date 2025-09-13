export type Message = {
    readonly id: string;
    readonly authorId: string;
    readonly channelId: string;
    readonly content: string;
};

export type FindMessageData = Omit<Message, "id">;
export type CreateMessageData = Message;
export type DeleteMessageData = Pick<Message, "id">;
export type EditMessageData = Pick<Message, "id" | "content">;
