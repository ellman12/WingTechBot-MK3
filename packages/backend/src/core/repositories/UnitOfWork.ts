import type { MessageRepository } from "./MessageRepository.js";
import type { ReactionEmoteRepository } from "./ReactionEmoteRepository.js";
import type { ReactionRepository } from "./ReactionRepository.js";
import type { SoundTagRepository } from "./SoundTagRepository.js";

export interface Repositories {
    readonly messageRepository: MessageRepository;
    readonly reactionRepository: ReactionRepository;
    readonly emoteRepository: ReactionEmoteRepository;
    readonly soundTagRepository: SoundTagRepository;
}

// Business logic layer interface for database transactions
export interface UnitOfWork {
    /**
     * Execute a function within a transactional context.
     * All repository operations within the work function will be committed atomically.
     *
     * @param work - Function containing repository operations to execute transactionally
     * @returns The result of the work function
     * @throws Error if the transaction fails or is rolled back
     */
    execute<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
}
