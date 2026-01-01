import { createMessageRepository } from "@adapters/repositories/MessageRepository.js";
import { createReactionEmoteRepository } from "@adapters/repositories/ReactionEmoteRepository.js";
import { createReactionRepository } from "@adapters/repositories/ReactionRepository.js";
import { createSoundTagRepository } from "@adapters/repositories/SoundTagRepository.js";
import type { Repositories, UnitOfWork } from "@core/repositories/UnitOfWork.js";
import type { DB } from "@db/types.js";
import type { Kysely } from "kysely";

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
