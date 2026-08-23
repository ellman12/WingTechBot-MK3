import { KarmaEmoteNames } from "@adapters/repositories/ReactionEmoteRepository.js";
import type { ReactionRepository } from "@adapters/repositories/ReactionRepository.js";
import { type DiscordChatService } from "@core/services/DiscordChatService.js";
import { formatEmoji } from "@core/utils/emojiUtils.js";
import { formatTable } from "@core/utils/formatTable.js";
import { getJumpUrl } from "@core/utils/messageUtils.js";
import { type ChatInputCommandInteraction, GuildMember, MessageFlags, Role, SlashCommandBuilder, userMention } from "discord.js";

import type { Command } from "./Commands.js";

export type ReactionCommandDeps = {
    reactionRepository: ReactionRepository;
    discordChatService: DiscordChatService;
};

type ReactionDirection = "given" | "received";

type Mentionable = ReturnType<ChatInputCommandInteraction["options"]["getMentionable"]>;

const resolveMentionable = async (interaction: ChatInputCommandInteraction, mentionable: Mentionable) => {
    if (mentionable === null) return;

    if (mentionable instanceof GuildMember) {
        return { ids: [mentionable.id], name: mentionable.user.username };
    }

    if (mentionable instanceof Role) {
        return { ids: mentionable.name === "@everyone" ? [] : mentionable.members.map(m => m.id), name: mentionable.name.replace("@", "") };
    }

    await interaction.reply({ content: "Invalid mentionable", flags: MessageFlags.Ephemeral });
    return "invalid";
};

export const createReactionCommands = ({ reactionRepository, discordChatService }: ReactionCommandDeps): Record<string, Command> => {
    const record: Command = {
        data: new SlashCommandBuilder()
            .setName("record")
            .setDescription("Shows your upvotes, downvotes, and awards")
            .addUserOption(option => option.setName("user").setDescription("Defaults to you").setRequired(false))
            .addNumberOption(option => option.setName("year").setDescription("Defaults to this year").setRequired(false)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const emojis = (await interaction.guild!.emojis.fetch()).filter(e => KarmaEmoteNames.includes(e.name));
            const karmaEmotes = Array.from(emojis.values());

            const user = interaction.options.getUser("user") ?? interaction.user;
            const year = interaction.options.getNumber("year") ?? undefined;

            const result = await reactionRepository.getKarmaAndAwards(user.id, year);
            const karma = result.reduce((sum, item) => sum + item.totalKarma, 0);

            const formattedEmotes = karmaEmotes.map(e => `${result.find(r => r.name === e.name)!.count} ${formatEmoji(e.name, e.id)}`);
            const response = `${userMention(user.id)} has ${karma} karma (${formattedEmotes.join(" ")}) ${year ? `for ${year}` : ""}`;
            await interaction.reply(response);
        },
    };

    async function handleReactions(interaction: ChatInputCommandInteraction, direction: ReactionDirection) {
        const primary = direction === "received" ? "receiver" : "giver";
        const secondary = direction === "received" ? "giver" : "receiver";

        const options = interaction.options;
        const primaryUser = options.getUser(primary) ?? interaction.user;
        const year = options.getNumber("year") ?? undefined;
        const limit = options.getNumber("limit") ?? 10;

        const resolved = await resolveMentionable(interaction, options.getMentionable(secondary));
        if (resolved === "invalid") return;

        const filterIds = resolved?.ids;
        const name = resolved?.name;

        const repoFn = direction === "received" ? reactionRepository.getReactionsReceived : reactionRepository.getReactionsGiven;
        const result = await repoFn(primaryUser.id, year, filterIds, limit);

        const fromToText = name ? (direction === "received" ? `from ${name}` : `to ${name}`) : "";
        const forYearText = year ? `for ${year}` : "";
        const filters = [fromToText, forYearText].filter(Boolean).join(" ");

        if (result.length === 0) {
            await interaction.reply(`No reactions ${direction} ${filters}`);
            return;
        }

        const messageHeader = direction === "received" ? `${primaryUser.username} received\n` : `${primaryUser.username} gave\n`;
        const messageBody = result.reduce((previous, current) => previous + `* ${current.count} ${formatEmoji(current.name, current.discordId)}\n`, messageHeader);
        const limitNote = result.length >= limit ? `\n*Showing the top ${limit} results*` : "";
        const response = `${messageBody}${filters}${limitNote}`;
        await discordChatService.replyToInteraction(interaction, response);
    }

    const reactionsReceived: Command = {
        data: new SlashCommandBuilder()
            .setName("reactions-received")
            .setDescription("Shows reactions you or a user has received")
            .addUserOption(option => option.setName("receiver").setDescription("The user to get reactions received for, defaulting to you").setRequired(false))
            .addNumberOption(option => option.setName("year").setDescription("The optional year to filter by").setRequired(false))
            .addMentionableOption(option => option.setName("giver").setDescription("The user or role that gave the reactions").setRequired(false))
            .addNumberOption(option => option.setName("limit").setDescription("Limit the size of the result").setRequired(false).setMinValue(1)),
        execute: interaction => handleReactions(interaction, "received"),
    };

    const reactionsGiven: Command = {
        data: new SlashCommandBuilder()
            .setName("reactions-given")
            .setDescription("Shows reactions you or a user has given")
            .addUserOption(option => option.setName("giver").setDescription("The user to get reactions given for, defaulting to you").setRequired(false))
            .addNumberOption(option => option.setName("year").setDescription("The optional year to filter by").setRequired(false))
            .addMentionableOption(option => option.setName("receiver").setDescription("The user or role that received the reactions").setRequired(false))
            .addNumberOption(option => option.setName("limit").setDescription("Limit the size of the result").setRequired(false).setMinValue(1)),
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
            const limit = interaction.options.getNumber("limit") ?? 10;

            const leaderboard = await reactionRepository.getEmoteLeaderboard(year, includeSelfReactions, limit);

            if (leaderboard.length === 0) {
                await interaction.reply(`No reactions ${year ? `for ${year}` : ""}`);
                return;
            }

            const { result: rankedRows } = leaderboard.reduce(
                (acc, current) => {
                    const { lastCount, rank, index, result } = acc;
                    const newRank = current.count === lastCount ? rank : index + 1;
                    result.push({ rank: `${newRank}.`, count: current.count, name: current.name });
                    return { lastCount: current.count, rank: newRank, index: index + 1, result };
                },
                { lastCount: 0, rank: 0, index: 0, result: [] as { rank: string; count: number; name: string }[] }
            );

            const table = formatTable(rankedRows, [
                { header: "Rank", value: r => r.rank },
                { header: "Count", value: r => String(r.count) },
                { header: "Emote", value: r => r.name },
            ]);

            const response = `${year ? `${year} ` : ""}Emote Leaderboard (Top ${limit})\n${table}`;
            await discordChatService.replyToInteraction(interaction, response, { backticks: true });
        },
    };

    const karmaLeaderboard: Command = {
        data: new SlashCommandBuilder()
            .setName("karma-leaderboard")
            .setDescription("Shows the leaderboard for karma")
            .addNumberOption(option => option.setName("year").setDescription("The optional year to filter by").setRequired(false))
            .addBooleanOption(option => option.setName("include-self-reactions").setDescription("If self-reactions should be included (defaults to false)").setRequired(false))
            .addBooleanOption(option => option.setName("filter-former-members").setDescription("If former server members should be filtered out (defaults to true)").setRequired(false))
            .addBooleanOption(option => option.setName("filter-unknown").setDescription("If unknown users should be filtered out (defaults to true)").setRequired(false)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const year = interaction.options.getNumber("year") ?? undefined;
            const includeSelfReactions = interaction.options.getBoolean("include-self-reactions") ?? false;
            const filterFormerMembers = interaction.options.getBoolean("filter-former-members") ?? true;
            const filterUnknown = interaction.options.getBoolean("filter-unknown") ?? true;

            const leaderboard = await reactionRepository.getKarmaLeaderboard(year, includeSelfReactions, filterFormerMembers, filterUnknown);

            if (leaderboard.length === 0) {
                await interaction.reply(`No reactions ${year ? `for ${year}` : ""}`);
                return;
            }

            const { result: rankedRows } = leaderboard.reduce(
                (acc, current) => {
                    const { lastCount, rank, index, result } = acc;
                    const newRank = current.totalKarma === lastCount ? rank : index + 1;
                    result.push({ rank: `${newRank}.`, karma: current.totalKarma, user: current.username ?? "Unknown" });
                    return { lastCount: current.totalKarma, rank: newRank, index: index + 1, result };
                },
                { lastCount: 0, rank: 1, index: 0, result: [] as { rank: string; karma: number; user: string }[] }
            );

            const table = formatTable(rankedRows, [
                { header: "Rank", value: r => r.rank },
                { header: "Karma", value: r => r.karma },
                { header: "User", value: r => r.user },
            ]);

            const response = `${year ? `${year} ` : ""}Karma Leaderboard\n${table}`;
            await discordChatService.replyToInteraction(interaction, response, { backticks: true });
        },
    };

    const topMessages: Command = {
        data: new SlashCommandBuilder()
            .setName("top-messages")
            .setDescription("Returns a selection of messages that got the most reactions, optionally with a specific emote")
            .addStringOption(option => option.setName("emote-name").setDescription("The name of the emote").setRequired(false))
            .addNumberOption(option => option.setName("year").setDescription("The optional year to filter by").setRequired(false))
            .addMentionableOption(option => option.setName("receiver").setDescription("The user or role that received the reactions").setRequired(false))
            .addNumberOption(option => option.setName("limit").setDescription("How many messages").setMinValue(1).setMaxValue(20).setRequired(false)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const emoteName = interaction.options.getString("emote-name") ?? undefined;
            const year = interaction.options.getNumber("year") ?? undefined;
            const limit = interaction.options.getNumber("limit") ?? 10;

            const resolved = await resolveMentionable(interaction, interaction.options.getMentionable("receiver"));
            if (resolved === "invalid") return;

            const authorIds = resolved ? resolved.ids : [interaction.user.id];
            const receiverName = resolved ? resolved.name : interaction.user.username;
            const topMessages = await reactionRepository.getTopMessages(authorIds, emoteName, year, limit);

            const emoteDescriptor = emoteName ? `with ${emoteName}` : "overall";
            const yearDescriptor = year ? `for ${year}` : "";

            if (topMessages.length === 0) {
                await interaction.reply(`No messages ${emoteDescriptor} for ${receiverName} ${yearDescriptor}`);
                return;
            }

            const entries = topMessages.map(entry => `${entry.count.toString().padEnd(4)}\t${getJumpUrl(interaction.guildId!, entry.channelId, entry.messageId)}`);
            const messageHeader = `Top ${limit} messages ${emoteDescriptor} for ${receiverName} ${yearDescriptor}\n`;
            const response = `${messageHeader}${entries.join("\n")}`;
            await discordChatService.replyToInteraction(interaction, response);
        },
    };

    return {
        record,
        "reactions-received": reactionsReceived,
        "reactions-given": reactionsGiven,
        "top-emotes": topEmotes,
        "karma-leaderboard": karmaLeaderboard,
        "top-messages": topMessages,
    };
};
