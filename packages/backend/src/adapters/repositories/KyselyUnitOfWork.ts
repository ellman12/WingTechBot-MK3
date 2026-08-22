import { createMessageRepository } from "@adapters/repositories/MessageRepository.js";
import { createReactionEmoteRepository } from "@adapters/repositories/ReactionEmoteRepository.js";
import { createReactionRepository } from "@adapters/repositories/ReactionRepository.js";
import { createSoundTagRepository } from "@adapters/repositories/SoundTagRepository.js";
import type { Repositories, UnitOfWork } from "@core/ports/repositories/UnitOfWork.js";
import type { DB } from "@db/types.js";
import type { Kysely } from "kysely";

//UnitOfWork over a Kysely transaction: every repository handed to `work` is bound to the same transaction.
export const createUnitOfWork = (db: Kysely<DB>): UnitOfWork => ({
    execute: async <T>(work: (repositories: Repositories) => Promise<T>): Promise<T> => {
        return await db.transaction().execute(async trx => {
            const repositories: Repositories = {
                messageRepository: createMessageRepository(trx),
                reactionRepository: createReactionRepository(trx),
                emoteRepository: createReactionEmoteRepository(trx),
                soundTagRepository: createSoundTagRepository(trx),
            };

            return await work(repositories);
        });
    },
});
