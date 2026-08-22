import { KarmaEmoteNames, type ReactionEmoteRef } from "@core/entities/ReactionEmote.js";
import type { ReactionEmoteRepository } from "@core/ports/repositories/ReactionEmoteRepository.js";
import type { Guild } from "discord.js";

export type EnsureKarmaEmotesDeps = {
    guild: Guild;
    emoteRepository: ReactionEmoteRepository;
};

//Resolves every karma emote to a server emoji and makes sure the database has it.
export const ensureKarmaEmotesFromGuild = async ({ guild, emoteRepository }: EnsureKarmaEmotesDeps): Promise<void> => {
    const cache = new Map((await guild.emojis.fetch()).map(e => [e.name, e]));

    const emotes: ReactionEmoteRef[] = KarmaEmoteNames.map(name => {
        const found = cache.get(name);
        if (!found) throw new Error(`Server emoji ${name} not found`);

        return { name, discordId: found.id };
    });

    await emoteRepository.ensureKarmaEmotes(emotes);
};
