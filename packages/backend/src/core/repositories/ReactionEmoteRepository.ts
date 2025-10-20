import type { CreateReactionEmoteData, ReactionEmote, UpdateReactionEmoteData } from "@core/entities/ReactionEmote.js";

export type ReactionEmoteRepository = {
    findById(id: number): Promise<ReactionEmote | null>;
    findByNameAndDiscordId(name: string, discordId: string): Promise<ReactionEmote | null>;
    findOrCreate(name: string, discordId: string): Promise<ReactionEmote>;
    create(data: CreateReactionEmoteData): Promise<ReactionEmote>;
    update(id: number, data: UpdateReactionEmoteData): Promise<ReactionEmote | null>;
};
