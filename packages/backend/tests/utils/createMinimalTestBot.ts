import { createUnitOfWork } from "@adapters/repositories/KyselyUnitOfWork.js";
import { createLlmInstructionRepository } from "@adapters/repositories/LlmInstructionRepository.js";
import { createMessageRepository } from "@adapters/repositories/MessageRepository.js";
import { createReactionEmoteRepository } from "@adapters/repositories/ReactionEmoteRepository.js";
import { createReactionRepository } from "@adapters/repositories/ReactionRepository.js";
import type { VoiceEventSoundsRepository } from "@adapters/repositories/VoiceEventSoundsRepository.js";
import type { Config } from "@core/config/Config.js";
import type { SoundRepository } from "@core/repositories/SoundRepository.js";
import { createAutoReactionService } from "@core/services/AutoReactionService.js";
import type { AutoReactionService } from "@core/services/AutoReactionService.js";
import type { CommandChoicesService } from "@core/services/CommandChoicesService.js";
import { createDiscordChatService } from "@core/services/DiscordChatService.js";
import type { DiscordChatService } from "@core/services/DiscordChatService.js";
import { createLlmConversationService } from "@core/services/LlmConversationService.js";
import type { LlmConversationService } from "@core/services/LlmConversationService.js";
import { createMessageArchiveService } from "@core/services/MessageArchiveService.js";
import type { MessageArchiveService } from "@core/services/MessageArchiveService.js";
import { createReactionArchiveService } from "@core/services/ReactionArchiveService.js";
import type { ReactionArchiveService } from "@core/services/ReactionArchiveService.js";
import type { SoundService } from "@core/services/SoundService.js";
import type { SoundTagService } from "@core/services/SoundTagService.js";
import type { SoundboardThreadService } from "@core/services/SoundboardThreadService.js";
import type { VoiceEventSoundsService } from "@core/services/VoiceEventSoundsService.js";
import type { VoiceService } from "@core/services/VoiceService.js";
import { runMigrations } from "@db/migrations.js";
import type { DB } from "@db/types.js";
import { createDatabaseConnection } from "@infrastructure/database/DatabaseConnection.js";
import { type DiscordBot, createDiscordBot } from "@infrastructure/discord/DiscordBot.js";
import { createFileManager } from "@infrastructure/filestore/FileManager.js";
import { createGeminiLlmService } from "@infrastructure/services/GeminiLlmService.js";
import type { GeminiLlmService } from "@infrastructure/services/GeminiLlmService.js";
import type { ThreadChannel } from "discord.js";
import type { Kysely } from "kysely";
import { Readable } from "stream";
import { vi } from "vitest";

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
    readonly autoReactionService?: ReturnType<typeof createAutoReactionService>;
    readonly reactionArchiveService?: ReturnType<typeof createReactionArchiveService>;
    readonly messageArchiveService?: ReturnType<typeof createMessageArchiveService>;
};

// Creates a minimal test bot with only the services needed for testing.
// Events are automatically filtered to only process channels in the allowed set.
export async function createMinimalTestBot(config: Config, schemaName: string, options: MinimalTestBotOptions): Promise<MinimalTestBot> {
    const databaseConnection = createDatabaseConnection(config, schemaName);
    await databaseConnection.connect();

    console.log(`⏱️  Running migrations for schema ${schemaName}...`);
    await runMigrations(schemaName);
    console.log(`✅ Migrations completed`);

    const db = databaseConnection.getKysely();

    const messageRepository = createMessageRepository(db);
    const reactionRepository = createReactionRepository(db);
    const emoteRepository = createReactionEmoteRepository(db);
    const fileManager = createFileManager();
    const llmInstructionRepo = createLlmInstructionRepository({ config, fileManager });

    const allowedChannels = new Set<string>();

    let autoReactionService: AutoReactionService | undefined;
    let reactionArchiveService: ReactionArchiveService | undefined;
    let messageArchiveService: MessageArchiveService | undefined;
    let llmConversationService: LlmConversationService | undefined;
    let discordChatService: DiscordChatService | undefined;
    let geminiLlmService: GeminiLlmService | undefined;

    if (options.reactionArchiveService || options.autoReactionService) {
        reactionArchiveService = createReactionArchiveService({
            messageRepository,
            reactionRepository,
            emoteRepository,
        });
    }

    if (options.messageArchiveService || options.llmConversationService) {
        const unitOfWork = createUnitOfWork(db);
        messageArchiveService = createMessageArchiveService({
            unitOfWork,
            messageRepository,
            fileManager,
        });
    }

    if (options.autoReactionService || options.llmConversationService) {
        discordChatService = createDiscordChatService({ config });
        geminiLlmService = createGeminiLlmService({ config });

        if (options.autoReactionService) {
            autoReactionService = createAutoReactionService({
                config,
                discordChatService,
                geminiLlmService,
                llmInstructionRepo,
            });
        }

        if (options.llmConversationService && messageArchiveService) {
            llmConversationService = createLlmConversationService({
                config,
                discordChatService,
                geminiLlmService,
                messageArchiveService,
                llmInstructionRepo,
            });
        }
    }

    // Stub services are no-ops since they won't be used in minimal test bots
    const createStubSoundRepository = (): SoundRepository => ({
        addSound: vi.fn().mockResolvedValue({ name: "", path: "" }),
        getSoundByName: vi.fn().mockResolvedValue(null),
        deleteSound: vi.fn().mockResolvedValue(undefined),
        getAllSounds: vi.fn().mockResolvedValue([]),
        getAllSoundsWithTagName: vi.fn().mockResolvedValue([]),
        tryGetSoundsWithinDistance: vi.fn().mockResolvedValue([]),
    });

    const createStubVoiceEventSoundsRepository = (): VoiceEventSoundsRepository => ({
        addVoiceEventSound: vi.fn().mockResolvedValue({ userId: "", soundId: 0, type: "UserJoin" as const }),
        deleteVoiceEventSound: vi.fn().mockResolvedValue(null),
        getVoiceEventSounds: vi.fn().mockResolvedValue([]),
    });

    const createStubSoundService = (): SoundService => ({
        addSound: async () => {},
        getSound: async () => new Readable(),
        getRepeatedSound: async () => "",
        listSounds: async () => [],
        deleteSound: async () => {},
    });

    const createStubSoundTagService = (): SoundTagService => ({
        addTagToSound: async () => false,
        removeTagFromSound: async () => false,
        listTags: async () => [],
    });

    const createStubVoiceService = (): VoiceService => ({
        connect: async () => {},
        disconnect: async () => {},
        isConnected: () => false,
        playAudio: async () => "",
        stopAudio: async () => {},
        stopAudioById: async () => false,
        stopAllAudio: async () => {},
        isPlaying: () => false,
        getActiveAudioCount: () => 0,
        getActiveAudioIds: () => [],
        getVolume: () => 1,
        setVolume: async () => {},
        pause: async () => {},
        resume: async () => {},
    });

    const createStubCommandChoicesService = (): CommandChoicesService => ({
        getAutocompleteChoices: async () => [],
    });

    const createStubSoundboardThreadService = (): SoundboardThreadService => ({
        findOrCreateSoundboardThread: vi.fn().mockResolvedValue({} as ThreadChannel),
        handleMessageCreated: vi.fn().mockResolvedValue(undefined),
    });

    const createStubVoiceEventSoundsService = (): VoiceEventSoundsService => ({
        voiceStateUpdate: async () => {},
    });

    // Wrap the client BEFORE setupEventHandlers is called so all events are intercepted
    const bot = await createDiscordBot({
        config,
        voiceEventSoundsRepository: createStubVoiceEventSoundsRepository(),
        soundRepository: createStubSoundRepository(),
        soundService: createStubSoundService(),
        soundTagService: createStubSoundTagService(),
        reactionRepository: reactionRepository || {
            find: vi.fn().mockResolvedValue(null),
            findForMessage: vi.fn().mockResolvedValue([]),
            create: vi.fn().mockResolvedValue({ giverId: "", receiverId: "", channelId: "", messageId: "", emoteId: 0 }),
            delete: vi.fn().mockResolvedValue(undefined),
            deleteReactionsForMessage: vi.fn().mockResolvedValue(undefined),
            deleteReactionsForEmote: vi.fn().mockResolvedValue(undefined),
            batchCreate: vi.fn().mockResolvedValue(undefined),
            batchDelete: vi.fn().mockResolvedValue(undefined),
            getKarmaAndAwards: vi.fn().mockResolvedValue([]),
            getReactionsReceived: vi.fn().mockResolvedValue([]),
            getReactionsGiven: vi.fn().mockResolvedValue([]),
            getEmoteLeaderboard: vi.fn().mockResolvedValue([]),
            getKarmaLeaderboard: vi.fn().mockResolvedValue([]),
            getTopMessages: vi.fn().mockResolvedValue([]),
        },
        emoteRepository: emoteRepository || {
            findById: vi.fn().mockResolvedValue(null),
            findByNameAndDiscordId: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 0, name: "", discordId: "", karmaValue: 0 }),
            update: vi.fn().mockResolvedValue(null),
            batchFindOrCreate: vi.fn().mockResolvedValue(new Map()),
            createKarmaEmotes: vi.fn().mockResolvedValue(undefined),
            getKarmaEmotes: vi.fn().mockResolvedValue([]),
        },
        reactionArchiveService: reactionArchiveService || {
            addReaction: vi.fn().mockResolvedValue(undefined),
            removeReaction: vi.fn().mockResolvedValue(undefined),
            removeReactionsForMessage: vi.fn().mockResolvedValue(undefined),
            removeReactionsForEmote: vi.fn().mockResolvedValue(undefined),
        },
        messageArchiveService: messageArchiveService || {
            fetchAllMessages: vi.fn().mockResolvedValue([]),
            processAllChannels: vi.fn().mockResolvedValue(undefined),
            messageCreated: vi.fn().mockResolvedValue(undefined),
            messageDeleted: vi.fn().mockResolvedValue(undefined),
            messageEdited: vi.fn().mockResolvedValue(undefined),
            getAllDBMessages: vi.fn().mockResolvedValue([]),
            getNewestDBMessages: vi.fn().mockResolvedValue([]),
            hasAnyMessages: vi.fn().mockResolvedValue(false),
        },
        discordChatService: discordChatService || {
            hasBeenPinged: vi.fn().mockReturnValue(false),
            replaceUserAndRoleMentions: vi.fn().mockResolvedValue(""),
            sendTypingIndicator: vi.fn().mockResolvedValue(undefined),
            formatMessageContent: vi.fn().mockReturnValue([]),
            sendMessage: vi.fn().mockResolvedValue(undefined),
            replyToInteraction: vi.fn().mockResolvedValue(undefined),
            followUpToInteraction: vi.fn().mockResolvedValue(undefined),
        },
        geminiLlmService: geminiLlmService || {
            generateMessage: vi.fn().mockResolvedValue(""),
        },
        llmConversationService: llmConversationService || {
            handleMessageCreated: vi.fn().mockResolvedValue(undefined),
        },
        llmInstructionRepo,
        soundboardThreadService: createStubSoundboardThreadService(),
        autoReactionService: autoReactionService || {
            reactionAdded: vi.fn().mockResolvedValue(undefined),
            messageCreated: vi.fn().mockResolvedValue(undefined),
        },
        voiceEventSoundsService: createStubVoiceEventSoundsService(),
        voiceService: createStubVoiceService(),
        commandChoicesService: createStubCommandChoicesService(),
        eventFilter: createChannelEventFilter(allowedChannels),
    });

    return {
        bot,
        db,
        allowedChannels,
        addChannel: (channelId: string) => {
            allowedChannels.add(channelId);
        },
        autoReactionService,
        reactionArchiveService,
        messageArchiveService,
    };
}
