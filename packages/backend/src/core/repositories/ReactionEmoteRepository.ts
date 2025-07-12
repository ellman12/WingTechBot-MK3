import type { CreateReactionEmoteData, ReactionEmote, UpdateReactionEmoteData } from "@core/entities/ReactionEmote";

export interface ReactionEmoteRepository {
    findById(id: number): Promise<ReactionEmote | null>;
    findByNameAndDiscordId(name: string, discordId: string): Promise<ReactionEmote | null>;
    create(data: CreateReactionEmoteData): Promise<ReactionEmote>;
    update(id: number, data: UpdateReactionEmoteData): Promise<ReactionEmote | null>;
}
