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

    function quoteAndHighlightMatch(content: string, matchRegex: RegExp, highlightPattern: string): string | undefined {
        const matches = content.match(matchRegex);
        if (!matches) return undefined;

        const match = matches[0];
        const highlightRegex = new RegExp(highlightPattern, "gi");
        return match.replace(highlightRegex, "**$1**");
    }

    async function checkForFunnySubstrings(message: Message): Promise<boolean> {
        if (message.author.id === botId) return false;

        const substrings = ["69420", "69", "420"];
        const matchRegex = new RegExp(`\\b(?:\\w+\\b\\W+){0,3}\\w*(${substrings.join("|")})\\w*(?:\\W+\\b\\w+\\b){0,3}`, "gi");
        const highlightPattern = `(${substrings.join("|")})`;

        const highlighted = quoteAndHighlightMatch(message.content, matchRegex, highlightPattern);
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

    function detectElliottMisspellings(name: string): { missingL: boolean; missingT: boolean } {
        return {
            missingL: /^eliot/i.test(name),
            missingT: /ell?iot(?!t)$/i.test(name),
        };
    }

    function applyCaseMapping(original: string, target: string, hasInsertedL: boolean): string {
        let result = "";
        const lastOrigChar = original.length > 0 ? original[original.length - 1]! : "e";

        for (let i = 0; i < target.length; i++) {
            const targetChar = target[i];
            if (!targetChar) continue;

            let origChar: string;
            if (i < 2) {
                origChar = original[i] ?? lastOrigChar;
            } else if (hasInsertedL && i === 2) {
                origChar = original[1] ?? lastOrigChar;
            } else {
                const adjustedIndex = hasInsertedL ? i - 1 : i;
                origChar = adjustedIndex < original.length ? (original[adjustedIndex] ?? lastOrigChar) : lastOrigChar;
            }

            const shouldBeUpper = origChar === origChar.toUpperCase() && origChar !== origChar.toLowerCase();
            result += shouldBeUpper ? targetChar.toUpperCase() : targetChar.toLowerCase();
        }
        return result;
    }

    function buildElliottReply(correctedWithCase: string, missingL: boolean, missingT: boolean): string {
        const insertBold = (text: string) => `**${text}**`;
        let reply = correctedWithCase.slice(0, 2); // "El"

        if (missingL && correctedWithCase[2]) {
            reply += insertBold(correctedWithCase[2]); // **"l"**
        } else if (correctedWithCase[2]) {
            reply += correctedWithCase[2]; // "l"
        }

        reply += correctedWithCase.slice(3, 6); // "iot"

        if (correctedWithCase[6]) {
            reply += missingT ? insertBold(correctedWithCase[6]) : correctedWithCase[6]; // **"t"** or "t"
        }

        return reply;
    }

    async function tryElliottReminder(message: Message): Promise<boolean> {
        if (message.author.id === botId) return false;

        const matchRegex = new RegExp(`\\b(?:\\w+\\b\\W+){0,3}\\w*(elliot(?!t)|eliott?)\\w*(?:\\W+\\b\\w+\\b){0,3}`, "gi");
        const highlightPattern = `(elliot(?!t)|eliott?)`;

        const matches = message.content.match(matchRegex);
        if (!matches) return false;

        const match = matches[0];
        const highlighted = quoteAndHighlightMatch(match, new RegExp(highlightPattern, "gi"), highlightPattern);
        if (!highlighted) return false;

        const nameMatch = match.match(new RegExp(highlightPattern, "i"));
        if (!nameMatch) return false;

        const originalName = nameMatch[0];
        const { missingL, missingT } = detectElliottMisspellings(originalName);

        const corrected = "elliot" + (missingT ? "t" : "tt");
        const correctedWithCase = applyCaseMapping(originalName, corrected, missingL);
        const reply = buildElliottReply(correctedWithCase, missingL, missingT);

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
