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
            .addUserOption(option => option.setName("receiver").setDescription("The user to get reactions received for, defaulting to you"))
            .addNumberOption(option => option.setName("year").setDescription("The optional year to filter by"))
            .addMentionableOption(option => option.setName("giver").setDescription("The user or role that gave the reactions")),
        execute: interaction => handleReactions(interaction, "received"),
    };

    const reactionsGiven: Command = {
        data: new SlashCommandBuilder()
            .setName("reactions-given")
            .setDescription("Shows reactions you or a user has given")
            .addUserOption(option => option.setName("giver").setDescription("The user to get reactions given for, defaulting to you"))
            .addNumberOption(option => option.setName("year").setDescription("The optional year to filter by"))
            .addMentionableOption(option => option.setName("receiver").setDescription("The user or role that received the reactions")),
        execute: interaction => handleReactions(interaction, "given"),
    };

    return {
        record,
        "reactions-received": reactionsReceived,
        "reactions-given": reactionsGiven,
    };
};
