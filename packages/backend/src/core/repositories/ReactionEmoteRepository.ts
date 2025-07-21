import type { CreateReactionEmoteData, ReactionEmote, UpdateReactionEmoteData } from "@core/entities/ReactionEmote";

export interface ReactionEmoteRepository {
    findById(id: number): Promise<ReactionEmote | null>;
    findByNameAndDiscordId(name: string, discordId: string | null): Promise<ReactionEmote | null>;
    findOrCreate(name: string, discordId: string | null): Promise<ReactionEmote>;
    create(data: CreateReactionEmoteData): Promise<ReactionEmote>;
    update(id: number, data: UpdateReactionEmoteData): Promise<ReactionEmote | null>;
}
