import type { CreateReactionEmoteData } from "@core/entities/ReactionEmote";

export type Reaction = { readonly id: number; readonly giverId: string; readonly receiverId: string; readonly channelId: string; readonly messageId: string; readonly emoteId: number };

export type FindReactionData = Omit<Reaction, "id">;
export type CreateReactionData = Reaction & Pick<CreateReactionEmoteData, "name" | "discordId">;
export type DeleteReactionData = FindReactionData;
