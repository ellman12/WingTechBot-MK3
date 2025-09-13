import type { FetchMessagesOptions, Message, TextChannel } from "discord.js";

export async function fetchAllMessages(channel: TextChannel) {
    let allMessages: Message[] = [];
    let lastId = null;

    while (true) {
        const options: FetchMessagesOptions = { limit: 100 };
        if (lastId) {
            options.before = lastId;
        }

        const messages = await channel.messages.fetch(options);
        if (messages.size === 0) break;

        allMessages = allMessages.concat(Array.from(messages.values()));
        lastId = messages.last()!.id;
    }

    return allMessages;
}
