import type { MessageArchiveService } from "@core/services/MessageArchiveService.js";
import { MessageEventQueue } from "@core/services/MessageEventQueue.js";
import type { ReactionArchiveService } from "@core/services/ReactionArchiveService.js";
import type { DiscordBot } from "@infrastructure/discord/DiscordBot.js";
import { Events } from "discord.js";

/**
 * Register message and reaction events through a queue to prevent race conditions.
 * Events for the same message are processed sequentially.
 * Events for different messages can be processed in parallel.
 */
export const registerQueuedMessageEvents = (messageArchiveService: MessageArchiveService, reactionArchiveService: ReactionArchiveService, registerEventHandler: DiscordBot["registerEventHandler"]): MessageEventQueue => {
    // Create the queue with a handler that routes events to the appropriate service
    const queue = new MessageEventQueue(async event => {
        switch (event.type) {
            case "messageCreate":
                await messageArchiveService.messageCreated(event.message);
                break;
            case "messageUpdate":
                await messageArchiveService.messageEdited(event.oldMessage, event.newMessage);
                break;
            case "messageDelete":
                await messageArchiveService.messageDeleted(event.message);
                break;
            case "reactionAdd":
                await reactionArchiveService.addReaction(event.reaction, event.user);
                break;
            case "reactionRemove":
                await reactionArchiveService.removeReaction(event.reaction, event.user);
                break;
            case "reactionRemoveAll":
                await reactionArchiveService.removeReactionsForMessage(event.message);
                break;
            case "reactionRemoveEmoji":
                await reactionArchiveService.removeReactionsForEmote(event.reaction);
                break;
        }
    });

    // Register event handlers that enqueue events
    registerEventHandler(Events.MessageCreate, message => {
        void queue.enqueue({ type: "messageCreate", message });
    });

    registerEventHandler(Events.MessageUpdate, (oldMessage, newMessage) => {
        void queue.enqueue({ type: "messageUpdate", oldMessage, newMessage });
    });

    registerEventHandler(Events.MessageDelete, message => {
        void queue.enqueue({ type: "messageDelete", message });
    });

    registerEventHandler(Events.MessageReactionAdd, (reaction, user) => {
        void queue.enqueue({ type: "reactionAdd", reaction, user });
    });

    registerEventHandler(Events.MessageReactionRemove, (reaction, user) => {
        void queue.enqueue({ type: "reactionRemove", reaction, user });
    });

    registerEventHandler(Events.MessageReactionRemoveAll, message => {
        void queue.enqueue({ type: "reactionRemoveAll", message });
    });

    registerEventHandler(Events.MessageReactionRemoveEmoji, reaction => {
        void queue.enqueue({ type: "reactionRemoveEmoji", reaction });
    });

    return queue;
};
