import type { CreateReactionData, DeleteReactionData, FindReactionData, Reaction } from "@core/entities/Reaction";

export interface ReactionRepository {
    find(data: FindReactionData): Promise<Reaction | null>;
    create(data: CreateReactionData): Promise<Reaction>;
    delete(data: DeleteReactionData): Promise<void>;
    deleteReactionsForMessage(messageId: string): Promise<void>;
    deleteReactionsForEmote(messageId: string, emoteId: number): Promise<void>;
}
