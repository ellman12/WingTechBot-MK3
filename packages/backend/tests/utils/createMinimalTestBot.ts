import { createFileManager } from "@adapters/filestore/FileManager.js";
import { createGeminiLlmService } from "@adapters/llm/GeminiLlmService.js";
import { createBannedFeaturesRepository } from "@adapters/repositories/BannedFeaturesRepository.js";
import { createUnitOfWork } from "@adapters/repositories/KyselyUnitOfWork.js";
import { createLlmInstructionRepository } from "@adapters/repositories/LlmInstructionRepository.js";
import { createMessageRepository } from "@adapters/repositories/MessageRepository.js";
import { createReactionEmoteRepository } from "@adapters/repositories/ReactionEmoteRepository.js";
import { createReactionRepository } from "@adapters/repositories/ReactionRepository.js";
import { createUserRepository } from "@adapters/repositories/UserRepository.js";
import { type AutoReaction, createAutoReaction } from "@application/discord/AutoReaction.js";
import { createDiscordApplication } from "@application/discord/DiscordApplication.js";
import { type DiscordChatService, createDiscordChatService } from "@application/discord/DiscordChat.js";
import { type LlmConversation, createLlmConversation } from "@application/discord/LlmConversation.js";
import { type MessageSync, createMessageSync } from "@application/discord/MessageSync.js";
import { type ReactionArchive, createReactionArchive } from "@application/discord/ReactionArchive.js";
import { createUserSync } from "@application/discord/UserSync.js";
import type { Config } from "@core/config/Config.js";
import { type AutoReactionService, createAutoReactionService } from "@core/services/AutoReactionService.js";
import { type LlmConversationService, createLlmConversationService } from "@core/services/LlmConversationService.js";
import { type MessageArchiveService, createMessageArchiveService } from "@core/services/MessageArchiveService.js";
import { type ReactionArchiveService, createReactionArchiveService } from "@core/services/ReactionArchiveService.js";
import { createUserSyncService } from "@core/services/UserSyncService.js";
import { runMigrations } from "@db/migrations.js";
import type { DB } from "@db/types.js";
import { createDatabaseConnection } from "@infrastructure/database/DatabaseConnection.js";
import { type DiscordBot, createDiscordBot } from "@infrastructure/discord/DiscordBot.js";
import { createDiscordClientHandle } from "@infrastructure/discord/DiscordClientHandle.js";
import type { Kysely } from "kysely";

import { createChannelEventFilter } from "./testEventInterceptor.js";

export type MinimalTestBotOptions = {
    readonly autoReactionService?: boolean;
    readonly reactionArchiveService?: boolean;
    readonly messageArchiveService?: boolean;
    readonly llmConversationService?: boolean;
};

export type MinimalTestBot = {
    readonly bot: DiscordBot;
    readonly db: Kysely<DB>;
    readonly allowedChannels: Set<string>;
    readonly addChannel: (channelId: string) => void;
    readonly discordChatService: DiscordChatService;
    //Core services (Discord-free) and their application counterparts, present only when the matching option is on.
    readonly autoReactionService?: AutoReactionService;
    readonly autoReaction?: AutoReaction;
    readonly reactionArchiveService?: ReactionArchiveService;
    readonly reactionArchive?: ReactionArchive;
    readonly messageArchiveService?: MessageArchiveService;
    readonly messageSync?: MessageSync;
    readonly llmConversationService?: LlmConversationService;
    readonly llmConversation?: LlmConversation;
};

// Creates a minimal test bot with only the features needed for a test.
// Events are automatically filtered to only process channels in the allowed set.
export async function createMinimalTestBot(config: Config, schemaName: string, options: MinimalTestBotOptions): Promise<MinimalTestBot> {
    const databaseConnection = createDatabaseConnection(config, schemaName);
    await databaseConnection.connect();

    console.log(`⏱️  Running migrations for schema ${schemaName}...`);
    await runMigrations(schemaName);
    console.log(`✅ Migrations completed`);

    const db = databaseConnection.getKysely();

    const unitOfWork = createUnitOfWork(db);
    const userRepository = createUserRepository(db);
    const messageRepository = createMessageRepository(db);
    const reactionRepository = createReactionRepository(db);
    const emoteRepository = createReactionEmoteRepository(db);
    const fileManager = createFileManager();
    const llmInstructionRepo = createLlmInstructionRepository({ config, fileManager });
    const bannedFeaturesRepository = createBannedFeaturesRepository(db);

    const allowedChannels = new Set<string>();

    const discordChatService = createDiscordChatService({ config });
    const userSync = createUserSync({ userSyncService: createUserSyncService({ userRepository, messageRepository, reactionRepository }) });

    let reactionArchiveService: ReactionArchiveService | undefined;
    let reactionArchive: ReactionArchive | undefined;
    if (options.reactionArchiveService || options.autoReactionService) {
        reactionArchiveService = createReactionArchiveService({ messageRepository, reactionRepository, emoteRepository });
        reactionArchive = createReactionArchive({ reactionArchiveService });
    }

    let messageArchiveService: MessageArchiveService | undefined;
    let messageSync: MessageSync | undefined;
    if (options.messageArchiveService || options.llmConversationService) {
        messageArchiveService = createMessageArchiveService({ unitOfWork, messageRepository });
        messageSync = createMessageSync({ messageArchiveService, fileManager });
    }

    let autoReactionService: AutoReactionService | undefined;
    let autoReaction: AutoReaction | undefined;
    let llmConversationService: LlmConversationService | undefined;
    let llmConversation: LlmConversation | undefined;
    if (options.autoReactionService || options.llmConversationService) {
        const llmService = createGeminiLlmService({ config });

        if (options.autoReactionService) {
            autoReactionService = createAutoReactionService({ config, llmService, llmInstructionRepo });
            autoReaction = createAutoReaction({ discordChatService, autoReactionService });
        }

        if (options.llmConversationService) {
            llmConversationService = createLlmConversationService({ config, messageRepository, llmService, llmInstructionRepo });
            llmConversation = createLlmConversation({ config, discordChatService, llmConversationService, bannedFeaturesRepository });
        }
    }

    const application = createDiscordApplication({
        config,
        emoteRepository,
        features: { userSync, reactionArchive, messageSync, autoReaction, llmConversation },
    });

    const bot = createDiscordBot({ config, clientHandle: createDiscordClientHandle(), application, eventFilter: createChannelEventFilter(allowedChannels) });

    return {
        bot,
        db,
        allowedChannels,
        addChannel: (channelId: string) => {
            allowedChannels.add(channelId);
        },
        discordChatService,
        autoReactionService,
        autoReaction,
        reactionArchiveService,
        reactionArchive,
        messageArchiveService,
        messageSync,
        llmConversationService,
        llmConversation,
    };
}
