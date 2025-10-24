export type ReactionEmote = { readonly id: number; readonly name: string; readonly discordId: string; readonly karmaValue: number };

export type UpdateReactionEmoteData = Pick<ReactionEmote, "karmaValue">;
