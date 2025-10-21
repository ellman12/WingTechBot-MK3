import type { ReactionEmoteRepository } from "@core/repositories/ReactionEmoteRepository.js";
import type { ReactionRepository } from "@core/repositories/ReactionRepository.js";
import { formatEmoji } from "@core/utils/emojiUtils";
import { type ChatInputCommandInteraction, GuildMember, MessageFlags, Role, SlashCommandBuilder, userMention } from "discord.js";

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

    const reactionsReceived: Command = {
        data: new SlashCommandBuilder()
            .setName("reactions-received")
            .setDescription("Shows reactions you or a user has received")
            .addUserOption(option => option.setName("receiver").setDescription("The user to get reactions received for, defaulting to you").setRequired(false))
            .addNumberOption(option => option.setName("year").setDescription("The optional year to filter by").setRequired(false))
            .addMentionableOption(option => option.setName("giver").setDescription("The user or role that gave the reactions").setRequired(false)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const receiver = interaction.options.getUser("receiver") ?? interaction.user;
            const year = interaction.options.getNumber("year") ?? undefined;
            const giver = interaction.options.getMentionable("giver");

            const userFilter = giver instanceof GuildMember ? (giver as GuildMember) : undefined;
            const roleFilter = giver instanceof Role ? (giver as Role) : undefined;

            let filterIds, name;
            if (userFilter) {
                filterIds = [userFilter.id];
                name = userFilter.user.username;
            } else if (roleFilter) {
                filterIds = roleFilter.name === "@everyone" ? undefined : roleFilter.members.map(m => m.id);
                name = roleFilter.name;
            }

            if (giver !== null && !userFilter && !roleFilter) {
                await interaction.reply({ content: "Invalid mentionable", flags: MessageFlags.Ephemeral });
                return;
            }

            const result = await reactionRepository.getReactionsReceived(receiver.id, year, filterIds);
            if (result.length === 0) {
                await interaction.reply(`No reactions received${name ? ` from ${name}` : ""}${year ? ` for ${year}` : ""}`);
                return;
            }

            const message = result.reduce((previous, current) => previous + `* ${current.count} ${formatEmoji(current.name, current.discordId)}\n`, `${receiver.username} received\n`);
            await interaction.reply(`${message}${name ? `from ${name}` : ""}${year ? `for ${year}` : ""}`);
        },
    };

    return {
        record,
        "reactions-received": reactionsReceived,
    };
};
