import type { VoiceEventSoundsRepository } from "@adapters/repositories/VoiceEventSoundsRepository.js";
import type { Command } from "@application/commands/Commands.js";
import type { SoundRepository } from "@core/repositories/SoundRepository.js";
import type { VoiceEventSoundType } from "@db/types";
import type { CommandChoicesService } from "@core/services/CommandChoicesService.js";
import { type APIApplicationCommandOptionChoice, type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";

export type VoiceEventSoundsCommandsDeps = {
    readonly voiceEventSoundsRepository: VoiceEventSoundsRepository;
    readonly soundRepository: SoundRepository;
    readonly commandChoicesService: CommandChoicesService;
};

const eventTypes: VoiceEventSoundType[] = ["UserJoin", "UserLeave"];
const eventTypeChoices: APIApplicationCommandOptionChoice<string>[] = eventTypes.map(t => ({ name: t, value: t }));

export const createVoiceEventSoundsCommands = ({ voiceEventSoundsRepository, soundRepository, commandChoicesService }: VoiceEventSoundsCommandsDeps): Record<string, Command> => {
    const assignVoiceEventSound: Command = {
        data: new SlashCommandBuilder()
            .setName("assign-voice-event-sound")
            .setDescription("Assigns a user a VoiceEventSound for an event")
            .addUserOption(option => option.setName("user").setDescription("The user to assign the sound to").setRequired(true))
            .addStringOption(option => option.setName("sound-name").setDescription("The name of the sound to assign to").setRequired(true).setAutocomplete(true))
            .addStringOption(option => option.setName("event-type").setDescription("The name of the event to listen for").setRequired(true).setChoices(eventTypeChoices)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const user = interaction.options.getUser("user")!;
            const soundName = interaction.options.getString("sound-name")!;
            const eventType = interaction.options.getString("event-type")! as VoiceEventSoundType;

            const sound = await soundRepository.getSoundByName(soundName);

            if (!sound) {
                await interaction.reply({ content: `Sound with name "${soundName}" doesn't exist`, flags: MessageFlags.Ephemeral });
                return;
            }

            await voiceEventSoundsRepository.addVoiceEventSound(user.id, sound.id!, eventType);
            await interaction.reply(`Assigned sound "${soundName}" to play for ${user.username} when ${eventType} is fired`);
        },
        getAutocompleteChoices: commandChoicesService.getAutocompleteChoices,
    };

    const removeVoiceEventSound: Command = {
        data: new SlashCommandBuilder()
            .setName("remove-voice-event-sound")
            .setDescription("Removes a VoiceEventSound for a user and event")
            .addUserOption(option => option.setName("user").setDescription("The user to remove the sound for").setRequired(true))
            .addStringOption(option => option.setName("sound-name").setDescription("The name of the sound to remove").setRequired(true).setAutocomplete(true))
            .addStringOption(option => option.setName("event-type").setDescription("The name of the event to remove").setRequired(true).setChoices(eventTypeChoices)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const user = interaction.options.getUser("user")!;
            const soundName = interaction.options.getString("sound-name")!;
            const eventType = interaction.options.getString("event-type")! as VoiceEventSoundType;

            const sound = await soundRepository.getSoundByName(soundName);

            if (!sound) {
                await interaction.reply({ content: `Sound with name "${soundName}" doesn't exist`, flags: MessageFlags.Ephemeral });
                return;
            }

            const result = await voiceEventSoundsRepository.deleteVoiceEventSound(user.id, sound.id!, eventType);
            if (result) {
                await interaction.reply(`Removed sound "${soundName}" for ${user.username} when ${eventType} is fired`);
            } else {
                await interaction.reply(`VoiceEventSound does not exist for ${soundName}, ${user.username}, ${eventType}`);
            }
        },
        getAutocompleteChoices: commandChoicesService.getAutocompleteChoices,
    };

    const listVoiceEventSounds: Command = {
        data: new SlashCommandBuilder()
            .setName("list-voice-event-sounds")
            .setDescription("Lists active VoiceEventSounds")
            .addUserOption(option => option.setName("user").setDescription("The optional user to filter by").setRequired(false))
            .addStringOption(option => option.setName("sound-name").setDescription("The optional sound name to filter by").setRequired(false).setAutocomplete(true))
            .addStringOption(option => option.setName("event-type").setDescription("The optional name of the event type to filter by").setRequired(false).setChoices(eventTypeChoices)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const user = interaction.options.getUser("user") ?? undefined;
            const soundName = interaction.options.getString("sound-name") ?? undefined;
            const eventType = interaction.options.getString("event-type") ?? undefined;

            const soundId = (await soundRepository.getSoundByName(soundName ?? ""))?.id ?? undefined;

            const sounds = await voiceEventSoundsRepository.getVoiceEventSounds({
                userId: user?.id,
                soundId,
                type: eventType as VoiceEventSoundType,
            });

            if (sounds.length === 0) {
                await interaction.reply("No VoiceEventSounds");
                return;
            }

            const result = sounds.map(s => `${(interaction.guild!.members.cache.get(s.userId)?.user.username ?? "Unknown User").padEnd(16)}${s.soundName!.padEnd(16)}${s.type}`);
            await interaction.reply(`\`\`\`User\t\t\tSound\t\t\tType\n-----------------------------------------\n${result.join("\n")}\`\`\``);
        },
        getAutocompleteChoices: commandChoicesService.getAutocompleteChoices,
    };

    return {
        "assign-voice-event-sound": assignVoiceEventSound,
        "remove-voice-event-sound": removeVoiceEventSound,
        "list-voice-event-sounds": listVoiceEventSounds,
    };
};
