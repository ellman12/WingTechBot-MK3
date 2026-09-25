import type { ReactionEmote, ReactionEmoteRef, UpdateReactionEmoteData } from "@core/entities/ReactionEmote.js";

export type ReactionEmoteRepository = {
    findById(id: number): Promise<ReactionEmote | null>;
    findByNameAndDiscordId(name: string, discordId: string): Promise<ReactionEmote | null>;
    create(name: string, discordId: string, karmaValue?: number): Promise<ReactionEmote>;
    update(id: number, data: UpdateReactionEmoteData): Promise<ReactionEmote | null>;

    batchFindOrCreate(emotes: ReactionEmoteRef[]): Promise<Map<string, ReactionEmote>>;

    //Creates the karma emotes (KarmaEmoteNames) with their default karma values if they don't exist yet.
    ensureKarmaEmotes(emotes: ReactionEmoteRef[]): Promise<void>;

    getKarmaEmotes(): Promise<ReactionEmote[]>;
};
