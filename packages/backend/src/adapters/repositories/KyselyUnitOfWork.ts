import type { DB } from "@db/types.js";
import type { Kysely } from "kysely";

import { type MessageRepository, createMessageRepository } from "./MessageRepository.js";
import { type ReactionEmoteRepository, createReactionEmoteRepository } from "./ReactionEmoteRepository.js";
import { type ReactionRepository, createReactionRepository } from "./ReactionRepository.js";
import { type SoundTagRepository, createSoundTagRepository } from "./SoundTagRepository.js";

export interface Repositories {
    readonly messageRepository: MessageRepository;
    readonly reactionRepository: ReactionRepository;
    readonly emoteRepository: ReactionEmoteRepository;
    readonly soundTagRepository: SoundTagRepository;
}

// Business logic layer interface for database transactions
export interface UnitOfWork {
    // Execute a function within a transactional context.
    // All repository operations within the work function will be committed atomically.
    execute<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
}

export class KyselyUnitOfWork implements UnitOfWork {
    constructor(private readonly db: Kysely<DB>) {}

    async execute<T>(work: (repositories: Repositories) => Promise<T>): Promise<T> {
        return await this.db.transaction().execute(async trx => {
            // Create transaction-scoped repository instances
            const repositories: Repositories = {
                messageRepository: createMessageRepository(trx),
                reactionRepository: createReactionRepository(trx),
                emoteRepository: createReactionEmoteRepository(trx),
                soundTagRepository: createSoundTagRepository(trx),
            };

            // Execute the work within the transaction
            return await work(repositories);
        });
    }
}

export const createUnitOfWork = (db: Kysely<DB>): UnitOfWork => {
    return new KyselyUnitOfWork(db);
};
