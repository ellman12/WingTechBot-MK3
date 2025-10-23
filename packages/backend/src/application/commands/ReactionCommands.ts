import type { ReactionEmoteRepository } from "@core/repositories/ReactionEmoteRepository.js";
import type { ReactionRepository } from "@core/repositories/ReactionRepository.js";
import { formatEmoji } from "@core/utils/emojiUtils";
import { type ChatInputCommandInteraction, GuildMember, MessageFlags, Role, SlashCommandBuilder, userMention } from "discord.js";

import type { Command } from "./Commands.js";

export type ReactionCommandDeps = {
    reactionRepository: ReactionRepository;
    emoteRepository: ReactionEmoteRepository;
};

type ReactionDirection = "given" | "received";

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
            const year = interaction.options.getNumber("year") ?? undefined;

            await interaction.deferReply();

            const result = new Map((await reactionRepository.getKarmaAndAwards(user.id, year)).map(r => [r.name, r]));
            const karma = [...result.values()].reduce((sum, item) => sum + item.totalKarma, 0);

            const formattedEmotes = karmaEmotes.map(e => `${result.get(e.name)!.count} ${formatEmoji(e.name, e.discordId)}`);
            const response = `${userMention(user.id)} has ${karma} karma (${formattedEmotes.join(" ")})${year ? ` for ${year}` : ""}`;
            await interaction.followUp(response);
        },
    };

    async function handleReactions(interaction: ChatInputCommandInteraction, direction: ReactionDirection) {
        const primary = direction === "received" ? "receiver" : "giver";
        const secondary = direction === "received" ? "giver" : "receiver";

        const primaryUser = interaction.options.getUser(primary) ?? interaction.user;
        const year = interaction.options.getNumber("year") ?? undefined;
        const secondaryMentionable = interaction.options.getMentionable(secondary);

        const userFilter = secondaryMentionable instanceof GuildMember ? secondaryMentionable : undefined;
        const roleFilter = secondaryMentionable instanceof Role ? secondaryMentionable : undefined;

        let filterIds: string[] | undefined;
        let name: string | undefined;

        if (userFilter) {
            filterIds = [userFilter.id];
            name = userFilter.user.username;
        } else if (roleFilter) {
            filterIds = roleFilter.name === "@everyone" ? undefined : roleFilter.members.map(m => m.id);
            name = roleFilter.name;
        }

        if (secondaryMentionable !== null && !userFilter && !roleFilter) {
            await interaction.reply({ content: "Invalid mentionable", flags: MessageFlags.Ephemeral });
            return;
        }

        const repoFn = direction === "received" ? reactionRepository.getReactionsReceived : reactionRepository.getReactionsGiven;
        const result = await repoFn(primaryUser.id, year, filterIds);

        if (result.length === 0) {
            await interaction.reply(`No reactions ${direction}${name ? (direction === "received" ? ` from ${name}` : ` to ${name}`) : ""}${year ? ` for ${year}` : ""}`);
            return;
        }

        const messageHeader = direction === "received" ? `${primaryUser.username} received\n` : `${primaryUser.username} gave\n`;
        const messageBody = result.reduce((previous, current) => previous + `* ${current.count} ${formatEmoji(current.name, current.discordId)}\n`, messageHeader);
        await interaction.reply(`${messageBody}${name ? (direction === "received" ? `from ${name}` : `to ${name}`) : ""}${year ? ` for ${year}` : ""}`);
    }

    const reactionsReceived: Command = {
        data: new SlashCommandBuilder()
            .setName("reactions-received")
            .setDescription("Shows reactions you or a user has received")
            .addUserOption(option => option.setName("receiver").setDescription("The user to get reactions received for, defaulting to you").setRequired(false))
            .addNumberOption(option => option.setName("year").setDescription("The optional year to filter by").setRequired(false))
            .addMentionableOption(option => option.setName("giver").setDescription("The user or role that gave the reactions").setRequired(false)),
        execute: interaction => handleReactions(interaction, "received"),
    };

    const reactionsGiven: Command = {
        data: new SlashCommandBuilder()
            .setName("reactions-given")
            .setDescription("Shows reactions you or a user has given")
            .addUserOption(option => option.setName("giver").setDescription("The user to get reactions given for, defaulting to you").setRequired(false))
            .addNumberOption(option => option.setName("year").setDescription("The optional year to filter by").setRequired(false))
            .addMentionableOption(option => option.setName("receiver").setDescription("The user or role that received the reactions").setRequired(false)),
        execute: interaction => handleReactions(interaction, "given"),
    };

    const topEmotes: Command = {
        data: new SlashCommandBuilder()
            .setName("top-emotes")
            .setDescription("Totals up how many reactions of each emote have been sent (optionally for a year)")
            .addNumberOption(option => option.setName("year").setDescription("The optional year to filter by").setRequired(false))
            .addBooleanOption(option => option.setName("include-self-reactions").setDescription("If self-reactions should be included (defaults to false)").setRequired(false))
            .addNumberOption(option => option.setName("limit").setDescription("Limit the size of the result").setRequired(false).setMinValue(1)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const year = interaction.options.getNumber("year") ?? undefined;
            const includeSelfReactions = interaction.options.getBoolean("include-self-reactions") ?? false;
            const limit = interaction.options.getNumber("limit") ?? 15;

            const leaderboard = await reactionRepository.getEmoteLeaderboard(year, includeSelfReactions, limit);

            if (leaderboard.length === 0) {
                await interaction.reply(`No reactions ${year ? `for ${year}` : ""}`);
                return;
            }

            const { result } = leaderboard.reduce(
                (acc, current) => {
                    const { lastCount, rank, index, result } = acc;
                    const newRank = current.count === lastCount ? rank : index + 1;

                    result.push(`${String(newRank + ".").padEnd(8)}${String(current.count).padEnd(8)}${current.name}`);
                    return { lastCount: current.count, rank: newRank, index: index + 1, result };
                },
                { lastCount: 0, rank: 0, index: 0, result: [] as string[] }
            );

            const response = `\`\`\`${year ? `${year} ` : ""}Emote Leaderboard (Top ${limit})\n-------------------------------\nRank    Count   Emote\n${result.join(`\n`)}\`\`\``;
            await interaction.reply(response);
        },
    };

    const karmaLeaderboard: Command = {
        data: new SlashCommandBuilder()
            .setName("karma-leaderboard")
            .setDescription("Shows the leaderboard for karma")
            .addNumberOption(option => option.setName("year").setDescription("The optional year to filter by").setRequired(false))
            .addBooleanOption(option => option.setName("include-self-reactions").setDescription("If self-reactions should be included (defaults to false)").setRequired(false)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const year = interaction.options.getNumber("year") ?? undefined;
            const includeSelfReactions = interaction.options.getBoolean("include-self-reactions") ?? false;
            const leaderboard = await reactionRepository.getKarmaLeaderboard(year, includeSelfReactions);

            if (leaderboard.length === 0) {
                await interaction.reply(`No reactions ${year ? `for ${year}` : ""}`);
                return;
            }

            const members = await interaction.guild!.members.fetch();

            const { result } = leaderboard.reduce(
                (acc, current) => {
                    const { lastCount, rank, index, result } = acc;
                    const newRank = current.totalKarma === lastCount ? rank : index + 1;

                    result.push(`${String(newRank + ".").padEnd(8)}${String(current.totalKarma).padEnd(8)}${members.get(current.userId)?.displayName ?? "Unknown"}`);
                    return { lastCount: current.totalKarma, rank: newRank, index: index + 1, result };
                },
                { lastCount: 0, rank: 1, index: 0, result: [] as string[] }
            );

            const response = `\`\`\`${year ? `${year} ` : ""}Karma Leaderboard\n------------------------\nRank    Karma   User\n${result.join(`\n`)}\`\`\``;
            await interaction.reply(response);
        },
    };

    return {
        record,
        "reactions-received": reactionsReceived,
        "reactions-given": reactionsGiven,
        "top-emotes": topEmotes,
        "karma-leaderboard": karmaLeaderboard,
    };
};
