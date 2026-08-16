import type { PlayedSoundsRepository } from "@adapters/repositories/PlayedSoundsRepository.js";
import type { SoundRepository } from "@adapters/repositories/SoundRepository.js";
import type { CommandChoicesService } from "@core/services/CommandChoicesService.js";
import { type DiscordChatService } from "@core/services/DiscordChatService.js";
import { format } from "date-fns";
import { type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";

import type { Command } from "./Commands.js";

export type PlayedSoundsCommandsDeps = {
    readonly soundRepository: SoundRepository;
    readonly playedSoundsRepository: PlayedSoundsRepository;
    readonly discordChatService: DiscordChatService;
    readonly commandChoicesService: CommandChoicesService;
};

export const createPlayedSoundsCommands = ({ soundRepository, playedSoundsRepository, discordChatService, commandChoicesService }: PlayedSoundsCommandsDeps): Record<string, Command> => {
    const soundPlayCount: Command = {
        data: new SlashCommandBuilder()
            .setName("sound-play-count")
            .setDescription("Returns how many times a sound has been used, optionally for a year and/or by a user")
            .addStringOption(option => option.setName("sound-name").setDescription("The name of the sound to get the count for").setRequired(true).setAutocomplete(true))
            .addUserOption(option => option.setName("user").setDescription("The optional user to filter by").setRequired(false))
            .addNumberOption(option => option.setName("year").setDescription("The optional year to filter by").setRequired(false)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const options = interaction.options;
            const soundName = options.getString("sound-name") ?? "";
            const user = options.getUser("user") ?? undefined;
            const year = interaction.options.getNumber("year") ?? undefined;

            const sound = await soundRepository.getSoundByName(soundName);
            if (!sound) {
                await interaction.reply({ content: `Sound ${soundName} does not exist`, flags: MessageFlags.Ephemeral });
                return;
            }

            const playCount = await playedSoundsRepository.getSoundPlayCount(sound.id!, user?.id, year);

            const parts = [`"${sound.name}" has been played`, `${playCount} times`, user && `by ${user.username}`, year && `for ${year}`];
            await interaction.reply(parts.filter(Boolean).join(" "));
        },
        getAutocompleteChoices: commandChoicesService.getAutocompleteChoices,
    };

    const soundPlayCounts: Command = {
        data: new SlashCommandBuilder()
            .setName("sound-play-counts")
            .setDescription("Returns how much each sound has been played")
            .addNumberOption(option => option.setName("limit").setDescription("Optional limit for the result").setRequired(false).setMinValue(1))
            .addUserOption(option => option.setName("user").setDescription("Optional user to filter by").setRequired(false))
            .addNumberOption(option => option.setName("year").setDescription("Optional year to filter by").setRequired(false)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const options = interaction.options;
            const limit = options.getNumber("limit") ?? undefined;
            const user = options.getUser("user") ?? undefined;
            const year = options.getNumber("year") ?? undefined;

            const leaderboard = await playedSoundsRepository.getSoundPlayCounts(limit, user?.id, year);
            if (leaderboard.length === 0) {
                await interaction.reply(`No played sounds ${year ? `for ${year}` : ""}`);
                return;
            }

            const { result } = leaderboard.reduce(
                (acc, current) => {
                    const { lastCount, rank, index, result } = acc;
                    const newRank = current.playCount === lastCount ? rank : index + 1;

                    result.push(`${String(newRank + ".").padEnd(8)}${String(current.playCount).padEnd(8)}${current.name}`);
                    return { lastCount: current.playCount, rank: newRank, index: index + 1, result };
                },
                { lastCount: 0, rank: 1, index: 0, result: [] as string[] }
            );

            const response = `${year ? `${year} ` : ""}Played Sound Counts\n-------------------\nRank    Count   Name\n${result.join(`\n`)}`;
            await discordChatService.replyToInteraction(interaction, response, { backticks: true });
        },
    };

    const fmt = (date: Date) => format(date, "MMM d, yyyy h:mm:ss a").padEnd(32);

    const soundPlayedDates: Command = {
        data: new SlashCommandBuilder()
            .setName("sound-played-dates")
            .setDescription("Returns the first and latest dates each sound was played")
            .addUserOption(option => option.setName("user").setDescription("Optional user to filter by").setRequired(false))
            .addNumberOption(option => option.setName("year").setDescription("Optional year to filter by").setRequired(false)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const options = interaction.options;
            const user = options.getUser("user") ?? undefined;
            const year = options.getNumber("year") ?? undefined;

            const dates = await playedSoundsRepository.getSoundPlayedDates(user?.id, year);
            if (dates.length === 0) {
                await interaction.reply(`No played sounds ${year ? `for ${year}` : ""}`);
                return;
            }

            const result = dates.map(d => `${d.name.padEnd(14)}${fmt(d.latestDate)}${fmt(d.oldestDate)}`);

            const response = `Name          Newest Played Date              Oldest Played Date\n${"-".repeat(64)}\n${result.join(`\n`)}`;
            await discordChatService.replyToInteraction(interaction, response, { backticks: true });
        },
    };

    return {
        "sound-play-count": soundPlayCount,
        "sound-play-counts": soundPlayCounts,
        "sound-played-dates": soundPlayedDates,
    };
};
