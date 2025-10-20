import type { CreateReactionEmoteData, ReactionEmote, UpdateReactionEmoteData } from "@core/entities/ReactionEmote.js";
import type { Guild } from "discord.js";

export type KarmaEmoteName = "upvote" | "downvote" | "silver" | "gold" | "platinum";
export const karmaEmoteNames: KarmaEmoteName[] = ["upvote", "downvote", "silver", "gold", "platinum"];

export type ReactionEmoteRepository = {
    findById(id: number): Promise<ReactionEmote | null>;
    findByNameAndDiscordId(name: string, discordId: string): Promise<ReactionEmote | null>;
    findOrCreate(name: string, discordId: string): Promise<ReactionEmote>;
    create(data: CreateReactionEmoteData): Promise<ReactionEmote>;
    update(id: number, data: UpdateReactionEmoteData): Promise<ReactionEmote | null>;

    //Adds the emotes from karmaEmoteNames if they don't already exist.
    createKarmaEmotes(guild: Guild): Promise<void>;
};
