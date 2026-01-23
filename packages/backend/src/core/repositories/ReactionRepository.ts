import type { CreateReactionData, DeleteReactionData, FindReactionData, Reaction } from "@core/entities/Reaction.js";

//Each emote and how many received, given, etc.
export type EmoteTotal = {
    readonly name: string;
    readonly discordId: string;
    readonly count: number;
    readonly totalKarma: number;
};
export type EmoteTotals = EmoteTotal[];

//Used for getKarmaLeaderboard().
export type KarmaLeaderboardEntry = {
    readonly userId: string;
    readonly username: string | null;
    readonly count: number;
    readonly totalKarma: number;
};

//Used for getTopMessages().
export type TopMessage = {
    readonly messageId: string;
    readonly channelId: string;
    readonly emoteId: number;
    readonly emoteName: string;
    readonly count: number;
};

export type ReactionRepository = {
    find(data: FindReactionData): Promise<Reaction | null>;
    findForMessage(messageId: string): Promise<Reaction[]>;
    create(data: CreateReactionData): Promise<Reaction>;
    delete(data: DeleteReactionData): Promise<void>;
    deleteReactionsForMessage(messageId: string): Promise<void>;
    deleteReactionsForEmote(messageId: string, emoteId: number): Promise<void>;

    batchCreate(reactions: CreateReactionData[]): Promise<void>;
    batchDelete(reactions: DeleteReactionData[]): Promise<void>;

    getKarmaAndAwards(userId: string, year?: number): Promise<EmoteTotals>;

    getReactionsReceived(receiverId: string, year?: number, giverIds?: string[]): Promise<EmoteTotals>;

    getReactionsGiven(giverId: string, year?: number, receiverIds?: string[]): Promise<EmoteTotals>;

    getEmoteLeaderboard(year?: number, includeSelfReactions?: boolean, limit?: number): Promise<EmoteTotals>;

    getKarmaLeaderboard(year?: number, includeSelfReactions?: boolean): Promise<KarmaLeaderboardEntry[]>;

    getTopMessages(authorId: string, emoteName: string, year?: number, limit?: number): Promise<TopMessage[]>;

    getUniqueUserIds(): Promise<string[]>;
};
