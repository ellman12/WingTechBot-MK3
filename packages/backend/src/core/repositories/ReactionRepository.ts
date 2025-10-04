import type { CreateReactionData, DeleteReactionData, FindReactionData, Reaction } from "@core/entities/Reaction.js";

export type ReactionRepository = {
    find(data: FindReactionData): Promise<Reaction | null>;
    findForMessage(messageId: string): Promise<Reaction[]>;
    create(data: CreateReactionData): Promise<Reaction>;
    delete(data: DeleteReactionData): Promise<void>;
    deleteReactionsForMessage(messageId: string): Promise<void>;
    deleteReactionsForEmote(messageId: string, emoteId: number): Promise<void>;
};
