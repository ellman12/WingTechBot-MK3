export type ReactionEmote = { readonly id: number; readonly name: string; readonly discordId: string; readonly karmaValue: number };

export type CreateReactionEmoteData = Omit<ReactionEmote, "id">;
export type UpdateReactionEmoteData = Pick<ReactionEmote, "karmaValue">;
