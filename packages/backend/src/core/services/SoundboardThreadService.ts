import type { SoundRepository } from "@core/repositories/SoundRepository";
import type { VoiceService } from "@core/services/VoiceService.js";
import { ChannelType, type Guild, type Message, type TextChannel, ThreadAutoArchiveDuration, type ThreadChannel } from "discord.js";

export type SoundboardThreadService = {
    readonly findOrCreateSoundboardThread: (guild: Guild) => Promise<ThreadChannel>;
    readonly handleMessageCreated: (message: Message) => Promise<void>;
};

export type SoundboardThreadServiceDeps = {
    readonly soundRepository: SoundRepository;
    readonly voiceService: VoiceService;
};

export const createSoundboardThreadService = ({ soundRepository, voiceService }: SoundboardThreadServiceDeps) => {
    const threadName = "WTB Soundboard";

    async function handleMessageCreated(message: Message) {
        await tryToPlaySoundFromMessage(message);
    }

    async function findOrCreateSoundboardThread(guild: Guild): Promise<ThreadChannel> {
        const channels = guild.channels;
        const botChannel = (await channels.fetch(process.env.DISCORD_BOT_CHANNEL_ID!)) as TextChannel;
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
        const channel = message.channel as TextChannel;
        if (channel.name !== threadName) {
            return;
        }

        try {
            const guild = message.guild!;
            const guildId = guild.id;
            const sound = await soundRepository.getSoundByName(message.content);
            if (!sound) {
                return;
            }

            if (!voiceService.isConnected(guildId)) {
                await voiceService.connect(message.guild!, process.env.DEFAULT_VOICE_CHANNEL_ID!);
            }

            await voiceService.playAudio(guildId, sound.name);
        } catch (error) {
            console.error("[SoundboardThreadService]", error);
        }
    }

    return {
        findOrCreateSoundboardThread,
        handleMessageCreated,
    };
};
