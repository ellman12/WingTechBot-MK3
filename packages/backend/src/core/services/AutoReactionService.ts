import type { Config } from "@core/config/Config.js";
import type { LlmInstructionRepository } from "@core/ports/repositories/LlmInstructionRepository.js";
import type { LlmService } from "@core/ports/services/LlmService.js";
import { oneIn, randomArrayItem } from "@core/utils/probabilityUtils.js";

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

export type AutoReactionMessage = {
    readonly authorId: string;
    //Display name of the author, used to attribute the message when it is sent to the LLM.
    readonly authorName: string;
    readonly content: string;
    //Returns the content with user/role/channel mentions replaced by names. Only called by the rules that need it, because it costs API calls.
    readonly getCleanedContent: () => Promise<string>;
    //Called right before a rule makes an LLM request, so the caller can show a typing indicator while it runs.
    readonly onLlmStart?: () => void;
};

export type SelfReactionInput = {
    readonly authorId: string;
    readonly reactorId: string;
    readonly emoteName: string | null | undefined;
};

export type AutoReactionResult = {
    readonly kind: "reply";
    readonly content: string;
    readonly usesLlm?: boolean;
};

export type AutoReactionService = {
    //Runs the auto-reaction rules against a message and returns the reply to send, or null if nothing fired.
    readonly evaluateMessage: (message: AutoReactionMessage) => Promise<AutoReactionResult | null>;
    //Returns the scold to send for a self-reaction, or null if this isn't a scoldable self-reaction.
    readonly getSelfReactionScold: (input: SelfReactionInput) => string | null;
};

export type AutoReactionServiceDeps = {
    readonly config: Config;
    readonly llmService: LlmService;
    readonly llmInstructionRepo: LlmInstructionRepository;
};

export const createAutoReactionService = ({ config, llmService, llmInstructionRepo }: AutoReactionServiceDeps): AutoReactionService => {
    console.log("[AutoReactionService] Creating AutoReactionService");

    const autoReactions: Array<{ probabilityDenominator: number; handler: (message: AutoReactionMessage) => Promise<AutoReactionResult | null> }> = [
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

    async function checkForFunnySubstrings(message: AutoReactionMessage): Promise<AutoReactionResult | null> {
        if (message.authorId === botId) return null;

        const initialFilteredContent = await message.getCleanedContent();

        const content = initialFilteredContent.replace(/<a?(:[a-zA-Z]+:)(\d+)>/g, (_, name, _id) => name);

        const substrings = ["69420", "69", "420"];
        const highlightPattern = `(${substrings.join("|")})`;
        const matchRegex = createWordContextRegex(highlightPattern);

        const highlighted = quoteAndHighlightMatch(content, matchRegex, highlightPattern);
        if (highlighted) {
            return { kind: "reply", content: `> ${highlighted}\nNice` };
        }

        return null;
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

    async function tryToSayErJoke(message: AutoReactionMessage): Promise<AutoReactionResult | null> {
        if (message.authorId === botId) return null;

        const erWord = findLastWordEndingWithEr(message.content);
        if (erWord) {
            return { kind: "reply", content: `"${erWord}"? I hardly even know 'er!` };
        }

        return null;
    }

    async function tryToNekoizeMessage(message: AutoReactionMessage): Promise<AutoReactionResult | null> {
        if (config.llm.disabled || message.authorId === botId) return null;

        message.onLlmStart?.();

        const content = await message.getCleanedContent();
        const systemInstruction = await llmInstructionRepo.getInstruction("nekoize");
        const response = await llmService.generateReply({ prompt: { role: "user", authorName: message.authorName, content }, systemInstruction });
        return { kind: "reply", content: response, usesLlm: true };
    }

    function applyCaseFromOriginal(original: string, target: string): string {
        const hasOneL = /^eliot/i.test(original);
        let result = "";
        let origIndex;

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

    async function tryElliottReminder(message: AutoReactionMessage): Promise<AutoReactionResult | null> {
        if (message.authorId === botId) return null;

        const ELLIOTT_PATTERN = `(elliot(?!t)|eliott?)`;
        const matchRegex = createWordContextRegex(ELLIOTT_PATTERN);

        const matches = message.content.match(matchRegex);
        if (!matches) return null;

        const fullMatch = matches[0];
        const nameMatch = fullMatch.match(new RegExp(ELLIOTT_PATTERN, "i"));
        if (!nameMatch) return null;

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
        if (!highlighted) return null;

        return { kind: "reply", content: `> ${highlighted}\n${reply}` };
    }

    return {
        evaluateMessage: async (message): Promise<AutoReactionResult | null> => {
            for (const { probabilityDenominator, handler } of autoReactions) {
                if (oneIn(probabilityDenominator)) {
                    const result = await handler(message);
                    if (result) return result;
                }
            }

            return null;
        },

        getSelfReactionScold: ({ authorId, reactorId, emoteName }): string | null => {
            if (authorId !== reactorId) {
                console.log(`[AutoReactionService] Skipping reaction - not a self-reaction (author: ${authorId}, user: ${reactorId})`);
                return null;
            }

            const scoldMessages = emoteName ? reactionScoldMessages[emoteName] : undefined;
            if (!scoldMessages) return null;

            return randomArrayItem(scoldMessages) ?? null;
        },
    };
};
