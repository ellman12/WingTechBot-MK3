import type { ReactionEmote, UpdateReactionEmoteData } from "@core/entities/ReactionEmote.js";
import { type ReactionEmoteRepository, karmaEmoteNames } from "@core/repositories/ReactionEmoteRepository.js";
import type { DB } from "@db/types.js";
import type { ReactionEmotes } from "@db/types.js";
import type { Guild } from "discord.js";
import type { Kysely, Selectable, Updateable } from "kysely";

//Transform database reaction emote to domain reaction emote
const transformReactionEmote = (dbEmote: Selectable<ReactionEmotes>): ReactionEmote => {
    return { id: dbEmote.id, name: dbEmote.name, discordId: dbEmote.discord_id, karmaValue: dbEmote.karma_value };
};

//Remove : : from an emote name.
const removeColons = (name: string) => {
    return name.replace(/^:(.*):$/, "$1");
};

export const defaultKarmaValues: Record<string, number> = {
    upvote: 1,
    downvote: -1,
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

    const createReactionEmote = async (name: string, discordId: string, karmaValue = 0): Promise<ReactionEmote> => {
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
            // Race condition: another process created this emote concurrently
            // Retry a few times to find the newly created emote
            for (let attempt = 0; attempt < 3; attempt++) {
                const existing = await findByNameAndDiscordId(parsedName, discordId);
                if (existing) return existing;

                // Small delay before retry to allow concurrent transaction to commit
                if (attempt < 2) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }

            throw new Error(`Failed to insert or find existing emote: ${parsedName} (${discordId})`);
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

    //Adds the emotes from karmaEmoteNames if they don't already exist.
    const createKarmaEmotes = async (guild: Guild): Promise<void> => {
        const cache = new Map((await guild.emojis.fetch()).map(e => [e.name, e]));

        for (const name of karmaEmoteNames) {
            const found = cache.get(name);
            if (!found) throw new Error(`Server emoji ${name} not found`);

            const karmaValue = defaultKarmaValues[name] ?? 0;
            await createReactionEmote(name, found.id, karmaValue);
        }
    };

    const getKarmaEmotes = async (): Promise<ReactionEmote[]> => {
        const emotes = await db.selectFrom("reaction_emotes").where("reaction_emotes.name", "in", karmaEmoteNames).selectAll().execute();
        return emotes.map(transformReactionEmote);
    };

    return {
        findById: findEmoteById,
        findByNameAndDiscordId,
        create: createReactionEmote,
        update: updateReactionEmote,
        createKarmaEmotes,
        getKarmaEmotes,
    };
};
