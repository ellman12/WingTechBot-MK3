import { fetchAllMessages } from "@adapters/messages/MessageFetcher";
import type { MessageRepository } from "@core/repositories/MessageRepository";
import type { ReactionEmoteRepository } from "@core/repositories/ReactionEmoteRepository";
import type { ReactionRepository } from "@core/repositories/ReactionRepository";
import { ChannelType, DiscordAPIError, type Guild, type Message, type TextChannel } from "discord.js";

export type MessageService = {
    //Walk backwards through each channel, and store/update each message until told to stop or hit the last message.
    readonly processAllChannels: (guild: Guild, endYear?: number) => Promise<void>;

    //Remove any messages from the DB that no longer exist on Discord.
    readonly removeDeletedMessages: (guild: Guild, endYear?: number) => Promise<void>;

    // readonly messageCreated: () => void;
    // readonly messageEdited: () => void;
    // readonly messageDeleted: () => void;
};

export type MessageServiceDeps = {
    messageRepository: MessageRepository;
    reactionRepository: ReactionRepository;
    emoteRepository: ReactionEmoteRepository;
};

async function processMessage(message: Message, messageRepository: MessageRepository, reactionRepository: ReactionRepository, emoteRepository: ReactionEmoteRepository): Promise<boolean> {
    if (message.partial) {
        await message.fetch();
    }

    const messageId = message.id;
    const channelId = message.channelId;
    const authorId = message.author.id;
    let created = false;

    const existingMsg = await messageRepository.findById(message.id);
    if (!existingMsg) {
        const referencedMessageId = message.reference ? message.reference.messageId : undefined;
        await messageRepository.create({ id: messageId, authorId, channelId, content: message.content, referencedMessageId });
        console.log(`Added message "${message.content}"`);
        created = true;
    }

    for (const reaction of message.reactions.cache.values()) {
        const discordId = reaction.emoji.id;
        const name = reaction.emoji.name!;
        const emote = await emoteRepository.findOrCreate(name, discordId);

        await reaction.users.fetch();
        for (const user of reaction.users.cache.values()) {
            const reactionData = { giverId: user.id, receiverId: authorId, channelId, messageId, emoteId: emote.id };
            const existingReaction = await reactionRepository.find(reactionData);
            if (!existingReaction) {
                await reactionRepository.create(reactionData);
            }
        }
    }

    return created;
}

export const createMessageService = ({ messageRepository, reactionRepository, emoteRepository }: MessageServiceDeps): MessageService => {
    console.log("[MessageService] Creating message service");

    async function processAllChannels(guild: Guild, endYear?: number): Promise<void> {
        console.log("💬 Begin processing messages in all channels");
        await guild.channels.fetch();
        const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).values();

        for (const channel of textChannels) {
            const name = channel.name;
            console.log(`🗨️ Begin processing messages in channel #${name}`);

            const allMessages = await fetchAllMessages(channel, endYear);
            let amountAdded = 0;

            for (const message of allMessages) {
                if (await processMessage(message, messageRepository, reactionRepository, emoteRepository)) {
                    amountAdded++;
                }
            }

            if (amountAdded > 0) {
                console.log(`Added ${amountAdded} messages to #${name}`);
            }
        }
    }

    async function removeDeletedMessages(guild: Guild, endYear?: number) {
        await guild.channels.fetch();

        const messages = endYear ? await messageRepository.getAllMessagesForYear(endYear) : await messageRepository.getAllMessages();

        let deleted = 0;

        for (const message of messages) {
            //Instead of returning null it errors if the message doesn't exist :(
            try {
                const channel = (await guild.channels.fetch(message.channelId)) as TextChannel;
                await channel.messages.fetch(message.id);
            } catch (error) {
                if (error instanceof DiscordAPIError && error.code === 10008) {
                    await messageRepository.delete({ id: message.id });
                    deleted++;
                } else {
                    console.error(`❌ Failed to fetch message ${message.id}`, error);
                }
            }
        }

        if (deleted > 0) {
            console.log(`🗑️ Removed ${deleted} deleted messages`);
        }
    }

    return {
        processAllChannels,
        removeDeletedMessages,
    };
};
