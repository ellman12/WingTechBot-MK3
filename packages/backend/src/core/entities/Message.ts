import type { Reaction } from "@core/entities/Reaction.js";

export type Message = {
    readonly id: string;
    readonly authorId: string;
    readonly channelId: string;
    readonly content: string;
    readonly referencedMessageId?: string;
    readonly createdAt: Date;
    readonly editedAt: Date | null;
    readonly reactions: Reaction[];
};

export type CreateMessageData = Omit<Message, "reactions">;
export type DeleteMessageData = Pick<Message, "id">;
export type EditMessageData = Pick<Message, "id" | "content" | "editedAt">;
