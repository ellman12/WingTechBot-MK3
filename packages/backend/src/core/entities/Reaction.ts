export type Reaction = { readonly giverId: string; readonly receiverId: string; readonly channelId: string; readonly messageId: string; readonly emoteId: number };

export type FindReactionData = Reaction;
export type CreateReactionData = Reaction;
export type DeleteReactionData = Reaction;
