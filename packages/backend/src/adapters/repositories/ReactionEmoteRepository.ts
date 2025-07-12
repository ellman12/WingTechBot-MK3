import type { CreateReactionEmoteData, ReactionEmote, UpdateReactionEmoteData } from "@core/entities/ReactionEmote";
import type { ReactionEmoteRepository } from "@core/repositories/ReactionEmoteRepository";
import type { DB } from "@db/types";
import type { ReactionEmotes } from "@db/types";
import type { Kysely, Selectable } from "kysely";

//Transform database reaction emote to domain reaction emote
const transformReactionEmote = (dbEmote: Selectable<ReactionEmotes>): ReactionEmote => {
    return { id: dbEmote.id, name: dbEmote.name, discordId: dbEmote.discord_id, karmaValue: dbEmote.karma_value };
};

//Factory function to create ReactionEmoteRepository instance
export const createReactionEmoteRepository = (db: Kysely<DB>): ReactionEmoteRepository => {
    const emotes = db.selectFrom("reaction_emotes").selectAll();

    const findEmoteById = async (id: number): Promise<ReactionEmote | null> => {
        const emote = await emotes.where("id", "=", id).executeTakeFirst();
        return emote ? transformReactionEmote(emote) : null;
    };

    const findByNameAndDiscordId = async (name: string, discordId: string | null): Promise<ReactionEmote | null> => {
        const emote = await emotes.where("name", "=", name).where("discord_id", "=", discordId).executeTakeFirst();
        return emote ? transformReactionEmote(emote) : null;
    };

    const createReactionEmote = async (data: CreateReactionEmoteData): Promise<ReactionEmote> => {
        if (data.name === "" || data.discordId === "") {
            throw new Error("Invalid data");
        }

        const existing = findByNameAndDiscordId(data.name, data.discordId);
        if (existing !== null) {
            throw new Error("Reaction emote exists");
        }

        const [emote] = await db.insertInto("reaction_emotes").values({ name: data.name, discord_id: data.discordId, karma_value: data.karmaValue }).returningAll().execute();

        if (!emote) {
            throw new Error("Failed to create reaction emote");
        }

        return transformReactionEmote(emote);
    };

    const updateReactionEmote = async (id: number, data: UpdateReactionEmoteData): Promise<ReactionEmote | null> => {
        const updateData: Record<string, unknown> = { updated_at: new Date() };

        if (data.karmaValue !== undefined) {
            updateData.karmaValue = data.karmaValue;
        }

        const [emote] = await db.updateTable("reaction_emotes").set(updateData).where("id", "=", id).returningAll().execute();
        return emote ? transformReactionEmote(emote) : null;
    };

    return { findById: findEmoteById, findByNameAndDiscordId, create: createReactionEmote, update: updateReactionEmote };
};
