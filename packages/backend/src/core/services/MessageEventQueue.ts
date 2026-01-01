import type { Message, MessageReaction, OmitPartialGroupDMChannel, PartialMessage, PartialMessageReaction, PartialUser, User } from "discord.js";

type QueuedEvent =
    | { type: "messageCreate"; message: Message }
    | { type: "messageUpdate"; oldMessage: OmitPartialGroupDMChannel<Message | PartialMessage>; newMessage: OmitPartialGroupDMChannel<Message> }
    | { type: "messageDelete"; message: OmitPartialGroupDMChannel<Message | PartialMessage> }
    | { type: "reactionAdd"; reaction: MessageReaction | PartialMessageReaction; user: User | PartialUser }
    | { type: "reactionRemove"; reaction: MessageReaction | PartialMessageReaction; user: User | PartialUser }
    | { type: "reactionRemoveAll"; message: OmitPartialGroupDMChannel<Message | PartialMessage> }
    | { type: "reactionRemoveEmoji"; reaction: MessageReaction | PartialMessageReaction };

type EventHandler = (event: QueuedEvent) => Promise<void>;

type QueueItem = {
    event: QueuedEvent;
    resolve: () => void;
    reject: (error: Error) => void;
};

/**
 * Message Event Queue Service
 *
 * Ensures that events for the same message are processed sequentially to prevent race conditions,
 * while allowing parallel processing across different messages for performance.
 */
export class MessageEventQueue {
    private queues = new Map<string, QueueItem[]>();
    private processing = new Set<string>();
    private handler: EventHandler;

    constructor(handler: EventHandler) {
        this.handler = handler;
    }

    /**
     * Enqueue an event for processing.
     * Events for the same message are processed sequentially.
     * Events for different messages can be processed in parallel.
     */
    async enqueue(event: QueuedEvent): Promise<void> {
        const messageId = this.getMessageId(event);

        return new Promise((resolve, reject) => {
            const item: QueueItem = { event, resolve, reject };

            // Get or create queue for this message
            if (!this.queues.has(messageId)) {
                this.queues.set(messageId, []);
            }

            this.queues.get(messageId)!.push(item);

            // Start processing if not already processing
            if (!this.processing.has(messageId)) {
                void this.processQueue(messageId);
            }
        });
    }

    private async processQueue(messageId: string): Promise<void> {
        this.processing.add(messageId);

        try {
            const queue = this.queues.get(messageId);
            if (!queue) {
                return;
            }

            while (queue.length > 0) {
                const item = queue.shift()!;

                try {
                    await this.handler(item.event);
                    item.resolve();
                } catch (error) {
                    console.error(`Error processing event for message ${messageId}:`, error);
                    item.reject(error instanceof Error ? error : new Error(String(error)));
                }
            }

            // Clean up empty queue
            this.queues.delete(messageId);
        } finally {
            this.processing.delete(messageId);
        }
    }

    private getMessageId(event: QueuedEvent): string {
        switch (event.type) {
            case "messageCreate":
                return event.message.id;
            case "messageUpdate":
                return event.newMessage.id;
            case "messageDelete":
                return event.message.id;
            case "reactionAdd":
            case "reactionRemove":
            case "reactionRemoveEmoji":
                return event.reaction.message.id;
            case "reactionRemoveAll":
                return event.message.id;
        }
    }

    /**
     * Get stats about the queue for monitoring/debugging
     */
    getStats() {
        return {
            activeQueues: this.queues.size,
            processingCount: this.processing.size,
            totalQueuedEvents: Array.from(this.queues.values()).reduce((sum, q) => sum + q.length, 0),
        };
    }
}
