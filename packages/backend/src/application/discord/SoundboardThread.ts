import type { RegisterEventHandler } from "@application/discord/EventRegistrar.js";
import type { Config } from "@core/config/Config.js";
import type { SoundboardService } from "@core/services/SoundboardService.js";
import { ChannelType, Events, type Guild, type Message, MessageFlags, type TextChannel, ThreadAutoArchiveDuration, type ThreadChannel } from "discord.js";

export type SoundboardThread = {
    readonly findOrCreateSoundboardThread: (guild: Guild) => Promise<ThreadChannel>;
    readonly handleMessageCreated: (message: Message) => Promise<void>;
};

export type SoundboardThreadDeps = {
    readonly config: Config;
    readonly soundboardService: SoundboardService;
};

const threadName = "WTB Soundboard";

export const createSoundboardThread = ({ config, soundboardService }: SoundboardThreadDeps): SoundboardThread => {
    function validMessage(message: Message): boolean {
        return message.channel.type !== ChannelType.DM && !message.flags.has(MessageFlags.Ephemeral) && message.channel.name === threadName && message.author.id !== config.discord.clientId;
    }

    async function findOrCreateSoundboardThread(guild: Guild): Promise<ThreadChannel> {
        const channels = guild.channels;
        const botChannel = (await channels.fetch(config.discord.botChannelId)) as TextChannel;
        if (!botChannel) {
            throw new Error("[SoundboardThread] Could not find bot channel!");
        }

        let thread = botChannel.threads.cache.find(t => t.name === threadName);
        if (!thread) {
            thread = await botChannel.threads.create({ name: threadName, type: ChannelType.PublicThread, autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek });
            await thread.send("Send sounds here to play them.");
        }

        await thread.setArchived(false);
        return thread;
    }

    async function handleMessageCreated(message: Message): Promise<void> {
        if (!validMessage(message)) {
            return;
        }

        try {
            const channel = message.channel as TextChannel;
            const userId = message.author.id;
            const resolution = await soundboardService.resolveSound({ userId, text: message.content });

            switch (resolution.kind) {
                case "banned":
                    await message.author.send("You are forbidden to use the soundboard");
                    return;
                case "noMatch":
                    return;
                case "ambiguous":
                    await channel.send(`Found multiple sounds: ${resolution.candidates.join(", ")}`);
                    return;
                case "resolved":
                    if (resolution.corrected) {
                        await channel.send(`Correcting "${resolution.originalText}" to sound "${resolution.soundName}"`);
                    }
                    await soundboardService.playSound(message.guild!.id, resolution.soundName, userId);
                    return;
            }
        } catch (error) {
            console.error("[SoundboardThread]", error);
        }
    }

    return {
        findOrCreateSoundboardThread,
        handleMessageCreated,
    };
};

export const registerSoundboardThreadEvents = (soundboardThread: SoundboardThread, register: RegisterEventHandler): void => {
    register(Events.MessageCreate, soundboardThread.handleMessageCreated);
};
