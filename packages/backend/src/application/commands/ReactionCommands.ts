import type { ReactionEmoteRepository } from "@core/repositories/ReactionEmoteRepository.js";
import type { ReactionRepository } from "@core/repositories/ReactionRepository.js";
import { formatEmoji } from "@core/utils/emojiUtils";
import { type ChatInputCommandInteraction, SlashCommandBuilder, userMention } from "discord.js";

import type { Command } from "./Commands.js";

export type ReactionCommandDeps = {
    reactionRepository: ReactionRepository;
    emoteRepository: ReactionEmoteRepository;
};

export const createReactionCommands = ({ reactionRepository, emoteRepository }: ReactionCommandDeps): Record<string, Command> => {
    const record: Command = {
        data: new SlashCommandBuilder()
            .setName("record")
            .setDescription("Shows your upvotes, downvotes, and awards")
            .addUserOption(option => option.setName("user").setDescription("Defaults to you").setRequired(false))
            .addNumberOption(option => option.setName("year").setDescription("Defaults to this year").setRequired(false)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const karmaEmotes = await emoteRepository.getKarmaEmotes();
            const user = interaction.options.getUser("user") ?? interaction.user;
            const year = interaction.options.getNumber("year") ?? new Date().getUTCFullYear();

            await interaction.deferReply();

            const result = new Map((await reactionRepository.getKarmaAndAwards(user.id, year)).map(r => [r.name, r]));
            const karma = [...result.values()].reduce((sum, item) => sum + item.totalKarma, 0);

            const formattedEmotes = karmaEmotes.map(e => `${result.get(e.name)!.count} ${formatEmoji(e.name, e.discordId)}`);
            const response = `${userMention(user.id)} has ${karma} karma (${formattedEmotes.join(" ")}) for ${year}`;
            await interaction.followUp(response);
        },
    };

    return {
        record,
    };
};
