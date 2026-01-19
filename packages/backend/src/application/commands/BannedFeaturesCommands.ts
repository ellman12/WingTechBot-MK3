import type { BannedFeaturesRepository } from "@adapters/repositories/BannedFeaturesRepository.js";
import type { Command } from "@application/commands/Commands.js";
import type { DiscordChatService } from "@core/services/DiscordChatService.js";
import type { AvailableFeatures } from "@db/types.js";
import { type ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

export type BannedFeaturesCommandsDeps = {
    bannedFeaturesRepository: BannedFeaturesRepository;
    discordChatService: DiscordChatService;
};

export const createBannedFeaturesCommands = ({ bannedFeaturesRepository, discordChatService }: BannedFeaturesCommandsDeps): Record<string, Command> => {
    //Matches with the values of the AvailableFeatures type from the DB.
    const availableFeatures = ["LlmConversations", "Reactions", "Soundboard"];
    const featureChoices = availableFeatures.map(f => ({ name: f, value: f }));

    const banFeature: Command = {
        data: new SlashCommandBuilder()
            .setName("ban-feature")
            .setDescription("Prevents a user from using a specific feature of WTB3")
            .addUserOption(option => option.setName("user").setDescription("The user to ban").setRequired(true))
            .addStringOption(option => option.setName("feature").setDescription("The feature to ban them from").setRequired(true).addChoices(featureChoices))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const user = interaction.options.getUser("user");
            const feature = interaction.options.getString("feature");
            if (!user || !feature) throw new Error("Missing data");

            const result = await bannedFeaturesRepository.banFeature(user.id, interaction.user.id, feature as AvailableFeatures);
            await interaction.reply({ content: `Banned ${result.feature} for ${user.displayName}`, flags: MessageFlags.Ephemeral });
        },
    };

    const unbanFeature: Command = {
        data: new SlashCommandBuilder()
            .setName("unban-feature")
            .setDescription("Revokes a user's ban of a WTB3 feature")
            .addUserOption(option => option.setName("user").setDescription("The user to revoke the ban from").setRequired(true))
            .addStringOption(option => option.setName("feature").setDescription("The feature").setRequired(true).addChoices(featureChoices))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const user = interaction.options.getUser("user");
            const feature = interaction.options.getString("feature");
            if (!user || !feature) throw new Error("Missing data");

            await bannedFeaturesRepository.unbanFeature(user.id, feature as AvailableFeatures);
            await interaction.reply({ content: `Unbanned ${feature} for ${user.displayName}`, flags: MessageFlags.Ephemeral });
        },
    };

    const getBannedUsers: Command = {
        data: new SlashCommandBuilder()
            .setName("get-banned-users")
            .setDescription("Lists all users that have bans")
            .addStringOption(option => option.setName("feature").setDescription("The optional feature to filter by").setRequired(false).addChoices(featureChoices))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const feature = (interaction.options.getString("feature") as AvailableFeatures | undefined) ?? undefined;

            const users = await bannedFeaturesRepository.getBannedUsers(feature);
            if (users.length === 0) {
                await interaction.reply("No banned users");
                return;
            }

            const members = await interaction.guild!.members.fetch();

            const displayName = (id: string) => (members.get(id)?.displayName ?? `Unknown-${id}`).padEnd(28);

            const usersByFeature = users.reduce<Record<string, typeof users>>((acc, user) => ({ ...acc, [user.feature]: [...(acc[user.feature] ?? []), user] }), {});

            const lines = Object.entries(usersByFeature).flatMap(([featureName, featureUsers]) => [
                "",
                `-- ${featureName} --`,
                "User".padEnd(28) + "Banned By".padEnd(28) + "Banned At",
                ...featureUsers
                    .slice()
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                    .map(u => displayName(u.userId) + displayName(u.bannedById) + u.createdAt.toLocaleString()),
            ]);

            const response = `\`\`\`\nBanned Features and Users\n${"-".repeat(30)}\n${lines.join("\n")}\n\`\`\``;
            await discordChatService.replyToInteraction(interaction, response, true);
        },
    };

    return {
        "ban-feature": banFeature,
        "unban-feature": unbanFeature,
        "get-banned-users": getBannedUsers,
    };
};
