import type { Message } from "@core/entities/Message.js";
import type { CreateReactionData, DeleteReactionData, FindReactionData, Reaction } from "@core/entities/Reaction.js";
import type { ReactionEmote } from "@core/entities/ReactionEmote.js";

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
    readonly karma: number;
};

//Used for getTopMessages().
export type TopMessage = {
    readonly message: Message;
    readonly emote: ReactionEmote;
    readonly count: number;
};

export type ReactionRepository = {
    find(data: FindReactionData): Promise<Reaction | null>;
    findForMessage(messageId: string): Promise<Reaction[]>;
    create(data: CreateReactionData): Promise<Reaction>;
    delete(data: DeleteReactionData): Promise<void>;
    deleteReactionsForMessage(messageId: string): Promise<void>;
    deleteReactionsForEmote(messageId: string, emoteId: number): Promise<void>;

    getKarmaAndAwards(userId: string, year?: number): Promise<EmoteTotals>;

    getReactionsReceived(receiverId: string, year?: number, giverIds?: string[]): Promise<EmoteTotals>;

    // //Gets all the reactions this user has given, optionally filtering by year and/or specific receivers. Ignores self-reactions (unless it's the only receiverId specified).
    // getReactionsGiven(giverId: string, year?: number, receiverIds?: string[]): Promise<EmoteTotals>;
    //
    // //Gets the leaderboard for karma, optionally for a year.
    // getKarmaLeaderboard(year?: number): Promise<KarmaLeaderboardEntry>;
    //
    // //Calculates which emotes have been used the most in reactions, *including* self-reactions.
    // getEmoteLeaderboard(year?: number): Promise<EmoteTotals>;
    //
    // //Returns a selection of messages that got the most reactions with this emote, excluding self-reactions.
    // getTopMessages(authorId: string, emoteName: string, limit?: number): Promise<TopMessage[]>;
};
