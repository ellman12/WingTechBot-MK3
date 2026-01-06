import type { LlmInstructionRepository } from "@adapters/repositories/LlmInstructionRepository.js";
import type { Config } from "@core/config/Config.js";
import type { DiscordChatService } from "@core/services/DiscordChatService.js";
import { oneIn, randomArrayItem } from "@core/utils/probabilityUtils.js";
import type { GeminiLlmService } from "@infrastructure/services/GeminiLlmService.js";
import type { Message, MessageReaction, PartialMessageReaction, PartialUser, TextChannel, User } from "discord.js";

export type AutoReactionService = {
    readonly reactionAdded: (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => Promise<void>;
    readonly messageCreated: (message: Message) => Promise<void>;
};

export type AutoReactionServiceDeps = {
    readonly config: Config;
    readonly discordChatService: DiscordChatService;
    readonly geminiLlmService: GeminiLlmService;
    readonly llmInstructionRepo: LlmInstructionRepository;
};

// Helper to check if error is due to Discord client being destroyed/token missing
// This is a safety net for race conditions during bot shutdown
const isClientDestroyedError = (error: unknown): boolean => {
    return error instanceof Error && error.message.includes("Expected token to be set for this request");
};

const upvoteScolds = [
    "god imagine upvoting yourself",
    "eww, a self-upvote",
    "upvoting yourself? cringe",
    "eww don't upvote yourself, this isn't reddit",
    "i'm going to verbally harass you if you keep upvoting yourself",
    "smh my head this man just self-upvoted",
    "gross self-upvote",
    "redditor",
    "you know upvoting yourself doesn't increase your karma, right?",
    "i'm telling ben you upvoted yourself",
    "upvoting yourself? not cool",
    "peepee poopoo don't upvote yourself",
    "only nerds upvote themselves",
];

const downvoteScolds = ["Why are you downvoting yourself??", "lol look at this idiot downvoting themselves"];

const awardScolds = [
    "really out here giving yourself an award, are ya?",
    "get a load of this guy giving themselves an award",
    "How you look giving yourself an award:\n[img](https://user-images.githubusercontent.com/14880945/104736592-80303380-5743-11eb-8224-2bae4fab6f15.png) \n", //Obama meme
];

export const reactionScoldMessages: Record<string, string[]> = {
    upvote: upvoteScolds,
    downvote: downvoteScolds,
    silver: awardScolds,
    gold: awardScolds,
    platinum: awardScolds,
};

export const createAutoReactionService = ({ config, discordChatService, geminiLlmService, llmInstructionRepo }: AutoReactionServiceDeps): AutoReactionService => {
    console.log("[AutoReactionService] Creating AutoReactionService");

    const autoReactions: Array<{ probabilityDenominator: number; handler: (message: Message) => Promise<boolean> }> = [
        { probabilityDenominator: config.autoReaction.funnySubstringsProbability, handler: checkForFunnySubstrings },
        { probabilityDenominator: config.autoReaction.erJokeProbability, handler: tryToSayErJoke },
        { probabilityDenominator: config.autoReaction.nekoizeProbability, handler: tryToNekoizeMessage },
        { probabilityDenominator: config.autoReaction.elliottReminderProbability, handler: tryElliottReminder },
    ];

    const botId = config.discord.clientId;

    function createWordContextRegex(pattern: string): RegExp {
        // Matches pattern with up to 3 words of context on each side
        return new RegExp(`\\b(?:\\w+\\b\\W+){0,3}\\w*${pattern}\\w*(?:\\W+\\b\\w+\\b){0,3}`, "gi");
    }

    function quoteAndHighlightMatch(content: string, matchRegex: RegExp, highlightPattern: string): string | undefined {
        const matches = content.match(matchRegex);
        if (!matches) return undefined;

        const match = matches[0];
        const highlightRegex = new RegExp(highlightPattern, "gi");
        return match.replace(highlightRegex, "**$1**");
    }

    async function checkForFunnySubstrings(message: Message): Promise<boolean> {
        if (message.author.id === botId) return false;

        const content = await discordChatService.replaceUserAndRoleMentions(message);

        const substrings = ["69420", "69", "420"];
        const highlightPattern = `(${substrings.join("|")})`;
        const matchRegex = createWordContextRegex(highlightPattern);

        const highlighted = quoteAndHighlightMatch(content, matchRegex, highlightPattern);
        if (highlighted) {
            await message.reply(`> ${highlighted}\nNice`);
            return true;
        }

        return false;
    }

    function findLastWordEndingWithEr(sentence: string) {
        const words = sentence.trim().split(/\s+/);
        let lastWord = words[words.length - 1];

        if (!lastWord) return;

        lastWord = lastWord.replace(/\W+$/, "");

        // Word must be at least 4 characters (to avoid single/double letter words)
        if (lastWord.length < 4) {
            return undefined;
        }

        if (lastWord.toLowerCase().endsWith("er")) {
            return lastWord;
        }

        return undefined;
    }

    async function tryToSayErJoke(message: Message): Promise<boolean> {
        if (message.author.id === botId) return false;

        const erWord = findLastWordEndingWithEr(message.content);
        if (erWord) {
            await message.reply(`"${erWord}"? I hardly even know 'er!`);
            return true;
        }

        return false;
    }

    async function tryToNekoizeMessage(message: Message): Promise<boolean> {
        if (config.llm.disabled || message.author.id === botId || process.env.CI) return false;

        const channel = (await message.channel.fetch()) as TextChannel;
        const controller = new AbortController();
        void discordChatService.sendTypingIndicator(controller.signal, channel);

        try {
            const content = await discordChatService.replaceUserAndRoleMentions(message);
            const systemInstruction = await llmInstructionRepo.getInstruction("nekoize");
            const response = await geminiLlmService.generateMessage(content, [], systemInstruction);
            await message.reply(response);
            return true;
        } finally {
            controller.abort();
        }
    }

    function applyCaseFromOriginal(original: string, target: string): string {
        const hasOneL = /^eliot/i.test(original);
        let result = "";
        let origIndex = 0;

        for (let i = 0; i < target.length; i++) {
            const targetChar = target[i];
            if (!targetChar) continue;

            // Position mapping: if we inserted an 'l' at position 2, adjust indices
            if (hasOneL && i === 2) {
                // Use case from first 'l' (position 1)
                origIndex = 1;
            } else if (hasOneL && i > 2) {
                // Shift back after inserted 'l'
                origIndex = i - 1;
            } else {
                origIndex = i;
            }

            const origChar = original[origIndex] ?? original[original.length - 1] ?? targetChar;
            const isUpper = origChar === origChar.toUpperCase() && origChar !== origChar.toLowerCase();
            result += isUpper ? targetChar.toUpperCase() : targetChar.toLowerCase();
        }

        return result;
    }

    async function tryElliottReminder(message: Message): Promise<boolean> {
        if (message.author.id === botId) return false;

        const ELLIOTT_PATTERN = `(elliot(?!t)|eliott?)`;
        const matchRegex = createWordContextRegex(ELLIOTT_PATTERN);

        const matches = message.content.match(matchRegex);
        if (!matches) return false;

        const fullMatch = matches[0];
        const nameMatch = fullMatch.match(new RegExp(ELLIOTT_PATTERN, "i"));
        if (!nameMatch) return false;

        const misspelling = nameMatch[0];
        const missingL = /^eliot/i.test(misspelling);
        const missingT = /ell?iot(?!t)$/i.test(misspelling);

        // Build corrected name with case from misspelling
        const corrected = applyCaseFromOriginal(misspelling, "elliott");

        // Bold the missing letters
        let reply = corrected.slice(0, 2);
        if (missingL) {
            reply += `**${corrected[2]}**`;
        } else {
            reply += corrected[2];
        }
        reply += corrected.slice(3, 6);
        if (missingT) {
            reply += `**${corrected[6]}**`;
        } else {
            reply += corrected[6];
        }

        const highlighted = quoteAndHighlightMatch(fullMatch, new RegExp(ELLIOTT_PATTERN, "gi"), ELLIOTT_PATTERN);
        if (!highlighted) return false;

        await message.reply(`> ${highlighted}\n${reply}`);
        return true;
    }

    return {
        reactionAdded: async (reaction, user): Promise<void> => {
            try {
                const message = await reaction.message.fetch();
                reaction = await reaction.fetch();

                if (message.author.id !== user.id) {
                    console.log(`[AutoReactionService] Skipping reaction - not a self-reaction (author: ${message.author.id}, user: ${user.id})`);
                    return;
                }

                const scoldMessages = reactionScoldMessages[reaction.emoji.name!];
                if (!scoldMessages) return;

                console.log(`[AutoReactionService] Sending scold message for self-reaction in channel ${message.channelId}`);
                await message.channel.send(`${randomArrayItem(scoldMessages)} <@${user.id}>`);
            } catch (e: unknown) {
                if (!isClientDestroyedError(e)) {
                    console.error("Error checking if added reaction needs to be scolded", e);
                }
            }
        },

        messageCreated: async (message): Promise<void> => {
            for (const { probabilityDenominator, handler } of autoReactions) {
                if (oneIn(probabilityDenominator) && (await handler(message))) {
                    return;
                }
            }
        },
    };
};
