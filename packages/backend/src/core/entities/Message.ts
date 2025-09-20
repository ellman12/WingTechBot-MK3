export type Message = {
    readonly id: string;
    readonly authorId: string;
    readonly channelId: string;
    readonly content: string;
    readonly referencedMessageId?: string;
};

export type CreateMessageData = Message;
export type DeleteMessageData = Pick<Message, "id">;
export type EditMessageData = Pick<Message, "id" | "content">;
