import type { AutoSoundsRepository } from "@adapters/repositories/AutoSoundsRepository.js";
import type { Command } from "@application/commands/Commands.js";
import type { SoundRepository } from "@core/repositories/SoundRepository.js";
import type { AutoSoundType } from "@db/types";
import { type APIApplicationCommandOptionChoice, type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";

export type AutoSoundsCommandsDeps = {
    readonly autoSoundsRepository: AutoSoundsRepository;
    readonly soundRepository: SoundRepository;
};

const eventTypes: AutoSoundType[] = ["UserJoin", "UserLeave"];
const eventTypeChoices: APIApplicationCommandOptionChoice<string>[] = eventTypes.map(t => ({ name: t, value: t }));

export const createAutoSoundsCommands = ({ autoSoundsRepository, soundRepository }: AutoSoundsCommandsDeps): Record<string, Command> => {
    const assignAutoSound: Command = {
        data: new SlashCommandBuilder()
            .setName("assign-auto-sound")
            .setDescription("Assigns a user an AutoSound for an event")
            .addUserOption(option => option.setName("user").setDescription("The user to assign the sound to").setRequired(true))
            .addStringOption(option => option.setName("sound-name").setDescription("The name of the sound to assign to").setRequired(true))
            .addStringOption(option => option.setName("event-type").setDescription("The name of the event to listen for").setRequired(true).setChoices(eventTypeChoices)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const user = interaction.options.getUser("user")!;
            const soundName = interaction.options.getString("sound-name")!;
            const eventType = interaction.options.getString("event-type")! as AutoSoundType;

            const sound = await soundRepository.getSoundByName(soundName);

            if (!sound) {
                await interaction.reply({ content: `Sound with name "${soundName}" doesn't exist`, flags: MessageFlags.Ephemeral });
                return;
            }

            await autoSoundsRepository.addAutoSound(user.id, sound.id!, eventType);
            await interaction.reply(`Assigned sound "${soundName}" to play for ${user.username} when ${eventType} is fired`);
        },
    };

    const removeAutoSound: Command = {
        data: new SlashCommandBuilder()
            .setName("remove-auto-sound")
            .setDescription("Removes an AutoSound for a user and event")
            .addUserOption(option => option.setName("user").setDescription("The user to assign the sound to").setRequired(true))
            .addStringOption(option => option.setName("sound-name").setDescription("The name of the sound to assign to").setRequired(true))
            .addStringOption(option => option.setName("event-type").setDescription("The name of the event to listen for").setRequired(true).setChoices(eventTypeChoices)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const user = interaction.options.getUser("user")!;
            const soundName = interaction.options.getString("sound-name")!;
            const eventType = interaction.options.getString("event-type")! as AutoSoundType;

            const sound = await soundRepository.getSoundByName(soundName);

            if (!sound) {
                await interaction.reply({ content: `Sound with name "${soundName}" doesn't exist`, flags: MessageFlags.Ephemeral });
                return;
            }

            const result = await autoSoundsRepository.deleteAutoSound(user.id, sound.id!, eventType);
            if (result) {
                await interaction.reply(`Removed sound "${soundName}" for ${user.username} when ${eventType} is fired`);
            } else {
                await interaction.reply(`AutoSound does not exist for ${soundName}, ${user.username}, ${eventType}`);
            }
        },
    };

    const listAutoSounds: Command = {
        data: new SlashCommandBuilder()
            .setName("list-auto-sounds")
            .setDescription("Lists active AutoSounds")
            .addUserOption(option => option.setName("user").setDescription("The optional user to filter by").setRequired(false))
            .addStringOption(option => option.setName("sound-name").setDescription("The optional sound name to filter by").setRequired(false))
            .addStringOption(option => option.setName("event-type").setDescription("The optional name of the event type to filter by").setRequired(false).setChoices(eventTypeChoices)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const user = interaction.options.getUser("user") ?? undefined;
            const soundName = interaction.options.getString("sound-name") ?? undefined;
            const eventType = interaction.options.getString("event-type") ?? undefined;

            const soundId = (await soundRepository.getSoundByName(soundName ?? ""))?.id ?? undefined;

            const sounds = await autoSoundsRepository.getAutoSounds({
                userId: user?.id,
                soundId,
                type: eventType as AutoSoundType,
            });

            if (sounds.length === 0) {
                await interaction.reply("No AutoSounds");
                return;
            }

            const result = sounds.map(s => `${(interaction.guild!.members.cache.get(s.userId)?.user.username ?? "Unknown User").padEnd(16)}${s.soundName!.padEnd(16)}${s.type}`);
            await interaction.reply(`\`\`\`User\t\t\tSound\t\t\tType\n-----------------------------------------\n${result.join("\n")}\`\`\``);
        },
    };

    return {
        "assign-auto-sound": assignAutoSound,
        "remove-auto-sound": removeAutoSound,
        "list-auto-sounds": listAutoSounds,
    };
};
