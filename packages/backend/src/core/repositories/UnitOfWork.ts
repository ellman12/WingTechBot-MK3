import type { MessageRepository } from "./MessageRepository.js";
import type { ReactionEmoteRepository } from "./ReactionEmoteRepository.js";
import type { ReactionRepository } from "./ReactionRepository.js";

/**
 * Repositories available within a unit of work transaction context
 */
export interface Repositories {
    readonly messageRepository: MessageRepository;
    readonly reactionRepository: ReactionRepository;
    readonly emoteRepository: ReactionEmoteRepository;
}

/**
 * Unit of Work pattern for coordinating transactional operations across multiple repositories.
 * Ensures that all operations within the work function execute atomically - either all succeed or all fail.
 */
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
