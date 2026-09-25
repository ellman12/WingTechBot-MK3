export type ReactionEmote = {
    readonly id: number;
    readonly name: string;
    readonly discordId: string;
    readonly karmaValue: number;
};

export type UpdateReactionEmoteData = Partial<Pick<ReactionEmote, "karmaValue">>;

//A (name, discordId) pair identifying a guild emote before it has a DB row.
export type ReactionEmoteRef = { readonly name: string; readonly discordId: string };

//The emotes that count towards karma. The guild must define emojis with these names.
export const KarmaEmoteNames = ["upvote", "downvote", "silver", "gold", "platinum"];

export const defaultKarmaValues: Record<string, number> = {
    upvote: 1,
    downvote: -1,
};
