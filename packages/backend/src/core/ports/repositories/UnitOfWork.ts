import type { MessageRepository } from "@core/ports/repositories/MessageRepository.js";
import type { ReactionEmoteRepository } from "@core/ports/repositories/ReactionEmoteRepository.js";
import type { ReactionRepository } from "@core/ports/repositories/ReactionRepository.js";
import type { SoundTagRepository } from "@core/ports/repositories/SoundTagRepository.js";

//Repositories bound to one transaction.
export type Repositories = {
    readonly messageRepository: MessageRepository;
    readonly reactionRepository: ReactionRepository;
    readonly emoteRepository: ReactionEmoteRepository;
    readonly soundTagRepository: SoundTagRepository;
};

//Executes a function within a transactional context; all repository operations inside commit atomically.
export type UnitOfWork = {
    readonly execute: <T>(work: (repositories: Repositories) => Promise<T>) => Promise<T>;
};
