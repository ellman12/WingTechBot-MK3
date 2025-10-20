import type { CreateReactionEmoteData, ReactionEmote, UpdateReactionEmoteData } from "@core/entities/ReactionEmote.js";
import type { ReactionEmoteRepository } from "@core/repositories/ReactionEmoteRepository.js";
import type { DB } from "@db/types.js";
import type { ReactionEmotes } from "@db/types.js";
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

    const findByNameAndDiscordId = async (name: string, discordId: string): Promise<ReactionEmote | null> => {
        const parsedName = removeColons(name);
        const query = emotes.where("name", "=", parsedName).where("discord_id", "=", discordId);

        const emote = await query.executeTakeFirst();
        return emote ? transformReactionEmote(emote) : null;
    };

    const findOrCreate = async (name: string, discordId: string): Promise<ReactionEmote> => {
        const existing = await findByNameAndDiscordId(name, discordId);
        return existing ?? (await createReactionEmote({ name, discordId, karmaValue: 0 }));
    };

    const createReactionEmote = async (data: CreateReactionEmoteData): Promise<ReactionEmote> => {
        const { name, discordId, karmaValue } = data;
        const parsedName = removeColons(name);

        if (parsedName === "" || discordId === "0") {
            throw new Error("Invalid data");
        }

        const [emote] = await db
            .insertInto("reaction_emotes")
            .values({ name: parsedName, discord_id: discordId, karma_value: karmaValue })
            .onConflict(oc => oc.columns(["name", "discord_id"]).doNothing())
            .returningAll()
            .execute();

        if (!emote) {
            const existing = await findByNameAndDiscordId(parsedName, discordId);
            if (existing) return existing;
            throw new Error("Failed to insert or find existing emote");
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

    return {
        findById: findEmoteById,
        findByNameAndDiscordId,
        findOrCreate,
        create: createReactionEmote,
        update: updateReactionEmote,
    };
};
