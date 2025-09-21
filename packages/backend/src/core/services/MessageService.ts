import type { CreateMessageData, Message as DBMessage } from "@core/entities/Message";
import type { Reaction } from "@core/entities/Reaction";
import type { MessageRepository } from "@core/repositories/MessageRepository";
import type { ReactionEmoteRepository } from "@core/repositories/ReactionEmoteRepository";
import type { ReactionRepository } from "@core/repositories/ReactionRepository";
import { ChannelType, DiscordAPIError, type FetchMessagesOptions, type Guild, type Message, type OmitPartialGroupDMChannel, type PartialMessage, type TextChannel } from "discord.js";
import equal from "fast-deep-equal/es6";

export type MessageService = {
    readonly fetchAllMessages: (channel: TextChannel, endYear?: number) => Promise<Message[]>;

    //Walk backwards through each channel, and store/update each message until told to stop or hit the last message.
    readonly processAllChannels: (guild: Guild, endYear?: number) => Promise<void>;

    //Remove any messages from the DB that no longer exist on Discord.
    readonly removeDeletedMessages: (guild: Guild, endYear?: number) => Promise<void>;

    readonly messageCreated: (message: Message) => Promise<void>;

    readonly messageDeleted: (message: OmitPartialGroupDMChannel<Message<boolean> | PartialMessage>) => Promise<void>;

    readonly messageEdited: (oldMessage: OmitPartialGroupDMChannel<Message<boolean> | PartialMessage>, newMessage: OmitPartialGroupDMChannel<Message<boolean>>) => Promise<void>;
};

export type MessageServiceDeps = {
    messageRepository: MessageRepository;
    reactionRepository: ReactionRepository;
    emoteRepository: ReactionEmoteRepository;
};

async function processMessage(discordMessage: Message, existingMessages: Map<string, DBMessage>, messageRepository: MessageRepository, reactionRepository: ReactionRepository, emoteRepository: ReactionEmoteRepository): Promise<boolean> {
    if (discordMessage.partial) {
        await discordMessage.fetch();
    }

    const messageId = discordMessage.id;
    const channelId = discordMessage.channelId;
    const authorId = discordMessage.author.id;
    const content = discordMessage.content;
    let created = false;

    //Add message if not already in DB, otherwise edit content if needed.
    let existingMsg = existingMessages.get(messageId);
    if (existingMsg && existingMsg.content !== discordMessage.content) {
        await messageRepository.edit({ id: messageId, content });
        console.log(`Edited content of message from ${discordMessage.author.username} in #${(discordMessage.channel as TextChannel).name}`);
    } else if (!existingMsg) {
        const referencedMessageId = discordMessage.reference ? discordMessage.reference.messageId : undefined;
        existingMsg = await messageRepository.create({ id: messageId, authorId, channelId, content, referencedMessageId, createdAt: discordMessage.createdAt, editedAt: discordMessage.editedAt });
        console.log(`Added message "${discordMessage.content}" from ${discordMessage.author.username} in #${(discordMessage.channel as TextChannel).name}`);
        created = true;
    }

    //Handle reactions
    const existingReactions = existingMsg!.reactions.map(({ id: _id, ...rest }) => rest);

    //Build a set of "current reactions" from Discord.
    const discordReactions: Omit<Reaction, "id">[] = [];

    for (const reaction of discordMessage.reactions.cache.values()) {
        const discordId = reaction.emoji.id;
        const name = reaction.emoji.name!;
        const emote = await emoteRepository.findOrCreate(name, discordId);

        await reaction.users.fetch();
        for (const user of reaction.users.cache.values()) {
            const reactionData = { giverId: user.id, receiverId: authorId, channelId, messageId, emoteId: emote.id };
            discordReactions.push(reactionData);

            //Add new reaction if missing in DB
            const existingReaction = existingReactions.find(r => equal(r, reactionData));
            if (!existingReaction) {
                await reactionRepository.create(reactionData);
            }
        }
    }

    //Remove reactions that exist in DB but not on Discord
    for (const existingReaction of existingReactions) {
        const stillExists = discordReactions.some(r => equal(r, existingReaction));
        if (!stillExists) {
            await reactionRepository.delete(existingReaction);
        }
    }

    return created;
}

async function getMessage(guild: Guild, channelId: string, messageId: string): Promise<Message | null> {
    //Instead of returning null it errors if the message doesn't exist :(
    try {
        const channel = (await guild.channels.fetch(channelId)) as TextChannel;
        return await channel.messages.fetch(messageId);
    } catch (error) {
        if (error instanceof DiscordAPIError && error.code === 10008) {
            return null;
        } else {
            console.error(`❌ Failed to fetch message ${messageId}`, error);
        }
    }

    return null;
}

export const createMessageService = ({ messageRepository, reactionRepository, emoteRepository }: MessageServiceDeps): MessageService => {
    console.log("[MessageService] Creating message service");

    async function fetchAllMessages(channel: TextChannel, endYear?: number) {
        let allMessages: Message[] = [];
        let lastId: string | null = null;

        while (true) {
            const options: FetchMessagesOptions = { limit: 100, before: lastId ?? undefined };
            const messages = await channel.messages.fetch(options);

            if (messages.size === 0) break;

            //Filter after storing lastId from the unfiltered batch
            lastId = messages.last()?.id ?? null;

            let filtered = messages;
            if (endYear !== undefined) {
                //Stop fetching once we've crossed the cutoff
                if (messages.some(m => m.createdAt.getUTCFullYear() < endYear)) {
                    filtered = messages.filter(m => m.createdAt.getUTCFullYear() >= endYear);
                    allMessages = allMessages.concat(Array.from(filtered.values()));
                    break; //exit, since older ones will all be before endYear
                }
            }

            allMessages = allMessages.concat(Array.from(filtered.values()));
        }

        return allMessages;
    }

    async function processAllChannels(guild: Guild, endYear?: number): Promise<void> {
        console.log("💬 Begin processing messages in all channels");
        await guild.channels.fetch();
        const textChannels = Array.from(guild.channels.cache.filter(c => c.type === ChannelType.GuildText).values());

        await Promise.all(
            textChannels.map(async channel => {
                const name = channel.name;
                console.log(`🗨️ Begin processing messages in #${name}`);

                const discordMessages = await fetchAllMessages(channel, endYear);
                const existingMessages = new Map((endYear ? await messageRepository.getAllMessagesForYear(endYear) : await messageRepository.getAllMessages()).map(m => [m.id, m]));
                console.log(`🗨️ Fetched ${discordMessages.length} messages from #${name}`);
                let amountAdded = 0;

                for (const message of discordMessages) {
                    if (await processMessage(message, existingMessages, messageRepository, reactionRepository, emoteRepository)) {
                        amountAdded++;
                    }
                }

                if (amountAdded > 0) {
                    console.log(`💾 Added ${amountAdded} messages from #${name}`);
                }

                console.log(`🗨️ Finish processing messages in #${name}`);
            })
        );

        console.log("💬 Finish processing all messages in all channels");
    }

    async function removeDeletedMessages(guild: Guild, endYear?: number) {
        await guild.channels.fetch();

        const messages = endYear ? await messageRepository.getAllMessagesForYear(endYear) : await messageRepository.getAllMessages();

        let deleted = 0;

        for (const message of messages) {
            const fetched = await getMessage(guild, message.channelId, message.id);
            if (!fetched) {
                await messageRepository.delete({ id: message.id });
                deleted++;
            }
        }

        if (deleted > 0) {
            console.log(`🗑️ Removed ${deleted} deleted messages`);
        }
    }

    async function messageCreated(message: Message): Promise<void> {
        if (message.partial) {
            await message.fetch();
        }

        try {
            const referencedMessageId = message.reference ? message.reference.messageId : undefined;
            const data: CreateMessageData = {
                id: message.id,
                authorId: message.author.id,
                channelId: message.channelId,
                content: message.content,
                referencedMessageId,
                createdAt: message.createdAt,
                editedAt: message.editedAt,
            };
            await messageRepository.create(data);
        } catch (e: unknown) {
            console.error("Error adding message to database", e, message.content);
        }
    }

    async function messageDeleted(message: OmitPartialGroupDMChannel<Message<boolean> | PartialMessage>): Promise<void> {
        if (message.partial) {
            await message.fetch();
        }

        try {
            await messageRepository.delete({ id: message.id });
        } catch (e: unknown) {
            console.error("Error removing message from database", e, message.content);
        }
    }

    async function messageEdited(oldMessage: OmitPartialGroupDMChannel<Message<boolean> | PartialMessage>, newMessage: OmitPartialGroupDMChannel<Message<boolean>>): Promise<void> {
        await newMessage.fetch();

        try {
            const id = newMessage.id;
            await messageRepository.edit({ id, content: newMessage.content });
        } catch (e: unknown) {
            console.error("Error updating content of message", e, newMessage.content);
        }
    }

    return {
        fetchAllMessages,
        processAllChannels,
        removeDeletedMessages,
        messageCreated,
        messageDeleted,
        messageEdited,
    };
};
