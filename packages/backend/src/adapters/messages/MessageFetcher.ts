import { type FetchMessagesOptions, type Message, type TextChannel } from "discord.js";

//Fetch all messages from the provided channel, optionally stopping once we reach messages on or before the end year.
export async function fetchAllMessages(channel: TextChannel, endYear?: number) {
    let allMessages: Message[] = [];
    let lastId: string | null = null;

    while (true) {
        const options: FetchMessagesOptions = { limit: 100, before: lastId ? lastId : undefined };
        let messages = await channel.messages.fetch(options);
        if (messages.size === 0) break;

        if (endYear !== undefined && messages.some(m => m.createdAt.getUTCFullYear() < endYear)) {
            messages = messages.filter(m => m.createdAt.getUTCFullYear() >= endYear);
        }

        allMessages = allMessages.concat(Array.from(messages.values()));
        lastId = messages.last()?.id ?? null;
    }

    return allMessages;
}
