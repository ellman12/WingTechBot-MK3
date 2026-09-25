import { type Commands, deployCommands, registerCommands } from "@application/commands/Commands.js";
import { type AutoReaction, registerAutoReactionEvents } from "@application/discord/AutoReaction.js";
import type { RegisterEventHandler } from "@application/discord/EventRegistrar.js";
import { ensureKarmaEmotesFromGuild } from "@application/discord/KarmaEmotes.js";
import { type LlmConversation, registerLlmConversationEvents } from "@application/discord/LlmConversation.js";
import { type MessageSync, registerMessageSyncEvents } from "@application/discord/MessageSync.js";
import { type ReactionArchive, registerReactionArchiveEvents } from "@application/discord/ReactionArchive.js";
import { type SoundboardThread, registerSoundboardThreadEvents } from "@application/discord/SoundboardThread.js";
import { type UserSync, registerUserSyncEvents } from "@application/discord/UserSync.js";
import { type VoiceAutoJoin, registerVoiceAutoJoinEvents } from "@application/discord/VoiceAutoJoin.js";
import { type VoiceEventSounds, registerVoiceEventSoundsEvents } from "@application/discord/VoiceEventSounds.js";
import type { Config } from "@core/config/Config.js";
import type { ReactionEmoteRepository } from "@core/ports/repositories/ReactionEmoteRepository.js";
import type { BotStatusService } from "@core/services/BotStatusService.js";
import { type Client, type Guild, PresenceUpdateStatus, type TextChannel } from "discord.js";

//Every Discord-facing feature. All optional so tests can assemble a bot with only the features under test.
export type DiscordFeatures = {
    readonly commands?: Commands;
    readonly messageSync?: MessageSync;
    readonly reactionArchive?: ReactionArchive;
    readonly userSync?: UserSync;
    readonly llmConversation?: LlmConversation;
    readonly autoReaction?: AutoReaction;
    readonly soundboardThread?: SoundboardThread;
    readonly voiceAutoJoin?: VoiceAutoJoin;
    readonly voiceEventSounds?: VoiceEventSounds;
};

export type DiscordApplicationDeps = {
    readonly config: Config;
    readonly features: DiscordFeatures;
    readonly emoteRepository: ReactionEmoteRepository;
    readonly botStatusService?: BotStatusService;
};

export type DiscordApplication = {
    //Binds every feature's event handlers to the client. Called by DiscordBot once per client.
    readonly registerEvents: (register: RegisterEventHandler) => void;
    //Startup orchestration, run after login with the guild resolved.
    readonly onReady: (ctx: { readonly client: Client<true>; readonly guild: Guild }) => Promise<void>;
};

//Wires application features into the Discord bot lifecycle. This is the application-layer counterpart of infrastructure/discord/DiscordBot.
export const createDiscordApplication = ({ config, features, emoteRepository, botStatusService }: DiscordApplicationDeps): DiscordApplication => {
    const registerEvents = (register: RegisterEventHandler): void => {
        if (features.commands) registerCommands({ commands: features.commands, registerEventHandler: register });
        if (features.userSync) registerUserSyncEvents(features.userSync, register);
        if (features.messageSync) registerMessageSyncEvents(features.messageSync, register);
        if (features.reactionArchive) registerReactionArchiveEvents(features.reactionArchive, register);
        if (features.llmConversation) registerLlmConversationEvents(features.llmConversation, register);
        if (features.soundboardThread) registerSoundboardThreadEvents(features.soundboardThread, register);
        if (features.voiceAutoJoin) registerVoiceAutoJoinEvents(features.voiceAutoJoin, register);
        if (features.autoReaction) registerAutoReactionEvents(features.autoReaction, register);
        if (features.voiceEventSounds) registerVoiceEventSoundsEvents(features.voiceEventSounds, register);
    };

    const deploySlashCommands = async (): Promise<void> => {
        if (!features.commands) return;

        if (config.discord.skipCommandDeploymentOnStartup) {
            console.log("⏩ Skipping command deployment (skipCommandDeploymentOnStartup = true)");
            return;
        }

        try {
            console.log("⏱️  Deploying Discord commands...");
            const deployStart = Date.now();
            await deployCommands({ commands: features.commands, token: config.discord.token, clientId: config.discord.clientId, guildId: config.discord.serverId });
            console.log(`✅ Commands deployed in ${Date.now() - deployStart}ms`);
        } catch (error) {
            console.warn("⚠️ Failed to deploy commands automatically:", error);
            console.log("💡 You can deploy commands manually with: pnpm discord:deploy-commands");
        }
    };

    const announceProduction = async (client: Client<true>, botChannel: TextChannel): Promise<void> => {
        if (botStatusService) {
            const status = await botStatusService.generateStatus();
            console.log(`✏ Setting Discord status to: "${status}"`);
            client.user.setActivity(status);
        }

        const description = `Version: ${process.env.GIT_TAG}\nCommit: ${process.env.GIT_COMMIT}\nhttps://github.com/ellman12/WingTechBot-MK3`;
        console.log(`Setting Discord bot description to ${description}`);
        await client.application.edit({ description });

        await botChannel.send("WTB3 online and ready");
    };

    const onReady = async ({ client, guild }: { client: Client<true>; guild: Guild }): Promise<void> => {
        //Command deployment is a REST call that can overlap with the rest of startup.
        const deploying = deploySlashCommands();

        //Fetched unconditionally so a bad BOT_CHANNEL_ID fails fast in every environment.
        const botChannel = (await guild.channels.fetch(config.discord.botChannelId)) as TextChannel;

        console.log("⏱️  Creating karma emotes...");
        const emotesStart = Date.now();
        await ensureKarmaEmotesFromGuild({ guild, emoteRepository });
        console.log(`✅ Karma emotes created in ${Date.now() - emotesStart}ms`);

        if (features.messageSync && !config.discord.skipChannelProcessingOnStartup) {
            const currentYear = new Date().getUTCFullYear();
            console.log(`🔄 Processing messages for ${currentYear}`);
            await features.messageSync.processAllChannels(guild, currentYear);
        }

        if (features.userSync && !config.discord.skipUserProcessingOnStartup) {
            console.log("⏱️  Syncing users...");
            const userSyncStart = Date.now();
            await features.userSync.syncUsers(client, guild);
            console.log(`✅ Users synced in ${Date.now() - userSyncStart}ms`);
        }

        if (features.soundboardThread) {
            await features.soundboardThread.findOrCreateSoundboardThread(guild);
        }

        client.user.setStatus(PresenceUpdateStatus.Online);

        if (config.server.environment === "production") {
            await announceProduction(client, botChannel);
        }

        await deploying;
    };

    return { registerEvents, onReady };
};
