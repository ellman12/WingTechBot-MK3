import type { CreateReactionEmoteData, ReactionEmote, UpdateReactionEmoteData } from "@core/entities/ReactionEmote";
import type { ReactionEmoteRepository } from "@core/repositories/ReactionEmoteRepository";
import type { DB } from "@db/types";
import type { ReactionEmotes } from "@db/types";
import type { Kysely, Selectable, Updateable } from "kysely";

//Transform database reaction emote to domain reaction emote
const transformReactionEmote = (dbEmote: Selectable<ReactionEmotes>): ReactionEmote => {
    return { id: dbEmote.id, name: dbEmote.name, discordId: dbEmote.discord_id, karmaValue: dbEmote.karma_value };
};

//Remove : : from an emote name.
const removeColons = (name: string) => {
    return name.replace(/^:(.*):$/, "$1");
};

//Factory function to create ReactionEmoteRepository instance
export const createReactionEmoteRepository = (db: Kysely<DB>): ReactionEmoteRepository => {
    const emotes = db.selectFrom("reaction_emotes").selectAll();

    const findEmoteById = async (id: number): Promise<ReactionEmote | null> => {
        const emote = await emotes.where("id", "=", id).executeTakeFirst();
        return emote ? transformReactionEmote(emote) : null;
    };

    const findByNameAndDiscordId = async (name: string, discordId: string | null): Promise<ReactionEmote | null> => {
        const parsedName = removeColons(name);
        let query = emotes.where("name", "=", parsedName);

        if (discordId === null) {
            query = query.where("discord_id", "is", null);
        } else {
            query = query.where("discord_id", "=", discordId);
        }

        const emote = await query.executeTakeFirst();
        return emote ? transformReactionEmote(emote) : null;
    };

    const findOrCreate = async (name: string, discordId: string | null): Promise<ReactionEmote> => {
        return (await findByNameAndDiscordId(name, discordId)) ?? (await createReactionEmote({ name, discordId, karmaValue: 0 }));
    };

    const createReactionEmote = async (data: CreateReactionEmoteData): Promise<ReactionEmote> => {
        const { name, discordId, karmaValue } = data;
        const parsedName = removeColons(name);

        if (parsedName === "" || discordId === "" || discordId === "0") {
            throw new Error("Invalid data");
        }

        const existing = await findByNameAndDiscordId(parsedName, discordId);
        if (existing !== null) {
            throw new Error("Reaction emote exists");
        }

        const [emote] = await db.insertInto("reaction_emotes").values({ name: parsedName, discord_id: discordId, karma_value: karmaValue }).returningAll().execute();

        if (!emote) {
            throw new Error("Failed to create reaction emote");
        }

        return transformReactionEmote(emote);
    };

    const updateReactionEmote = async (id: number, data: UpdateReactionEmoteData): Promise<ReactionEmote | null> => {
        const updateData: Updateable<ReactionEmotes> = { updated_at: new Date() };

        if (data.karmaValue !== undefined) {
            updateData.karma_value = data.karmaValue;
        }

        const [emote] = await db.updateTable("reaction_emotes").set(updateData).where("id", "=", id).returningAll().execute();
        return emote ? transformReactionEmote(emote) : null;
    };

    return { findById: findEmoteById, findByNameAndDiscordId, findOrCreate, create: createReactionEmote, update: updateReactionEmote };
};
