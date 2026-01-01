import type { ReactionEmote, UpdateReactionEmoteData } from "@core/entities/ReactionEmote.js";
import type { Guild } from "discord.js";

export type KarmaEmoteName = "upvote" | "downvote" | "silver" | "gold" | "platinum";
export const karmaEmoteNames: KarmaEmoteName[] = ["upvote", "downvote", "silver", "gold", "platinum"];

export type ReactionEmoteRepository = {
    findById(id: number): Promise<ReactionEmote | null>;
    findByNameAndDiscordId(name: string, discordId: string): Promise<ReactionEmote | null>;
    create(name: string, discordId: string, karmaValue?: number): Promise<ReactionEmote>;
    update(id: number, data: UpdateReactionEmoteData): Promise<ReactionEmote | null>;

    batchFindOrCreate(emotes: Array<{ name: string; discordId: string }>): Promise<Map<string, ReactionEmote>>;

    createKarmaEmotes(guild: Guild): Promise<void>;

    getKarmaEmotes(): Promise<ReactionEmote[]>;
};
