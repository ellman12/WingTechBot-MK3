import type { Config } from "@core/config/Config.js";
import type { SoundRepository } from "@core/repositories/SoundRepository.js";
import type { VoiceService } from "@core/services/VoiceService.js";
import { ChannelType, type Guild, type Message, MessageFlags, type TextChannel, ThreadAutoArchiveDuration, type ThreadChannel } from "discord.js";

export type SoundboardThreadService = {
    readonly findOrCreateSoundboardThread: (guild: Guild) => Promise<ThreadChannel>;
    readonly handleMessageCreated: (message: Message) => Promise<void>;
};

export type SoundboardThreadServiceDeps = {
    readonly config: Config;
    readonly soundRepository: SoundRepository;
    readonly voiceService: VoiceService;
};

const threadName = "WTB Soundboard";

export const createSoundboardThreadService = ({ config, soundRepository, voiceService }: SoundboardThreadServiceDeps) => {
    function validMessage(message: Message): boolean {
        return message.channel.type !== ChannelType.DM && !message.flags.has(MessageFlags.Ephemeral) && message.channel.name === threadName && message.author.id !== config.discord.clientId;
    }
    async function handleMessageCreated(message: Message) {
        await tryToPlaySoundFromMessage(message);
    }

    async function findOrCreateSoundboardThread(guild: Guild): Promise<ThreadChannel> {
        const channels = guild.channels;
        const botChannel = (await channels.fetch(config.discord.botChannelId)) as TextChannel;
        if (!botChannel) {
            throw new Error("[SoundboardThreadService] Could not find bot channel!");
        }

        let thread = botChannel.threads.cache.find(t => t.name === threadName);
        if (!thread) {
            thread = await botChannel.threads.create({ name: threadName, type: ChannelType.PublicThread, autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek });
            await thread.send("Send sounds here to play them.");
        }

        await thread.setArchived(false);
        return thread;
    }

    async function tryToPlaySoundFromMessage(message: Message) {
        if (!validMessage(message)) {
            return;
        }

        try {
            const guild = message.guild!;
            const guildId = guild.id;
            const channel = message.channel as TextChannel;
            const content = message.content;
            const foundSounds = await soundRepository.tryGetSoundsWithinDistance(content);
            if (foundSounds.length === 0) {
                return;
            }

            //Since sound names are unique there can only be one with distance of 0.
            const closestSound = foundSounds.find(s => s.distance === 0);
            if (!closestSound) {
                if (foundSounds.length > 1) {
                    const response = `Found multiple sounds: ${foundSounds.map(s => s.name).join(", ")}`;
                    await channel.send(response);
                    return;
                }

                await channel.send(`Correcting "${content}" to sound "${foundSounds[0]!.name}"`);
            }

            if (!voiceService.isConnected(guildId)) {
                await voiceService.connect(message.guild!, config.discord.defaultVoiceChannelId);
            }

            await voiceService.playAudio(guildId, (closestSound ?? foundSounds[0]!).name);
        } catch (error) {
            console.error("[SoundboardThreadService]", error);
        }
    }

    return {
        findOrCreateSoundboardThread,
        handleMessageCreated,
    };
};
