import type { LlmInstructionRepository } from "@adapters/repositories/LlmInstructionRepository.js";
import type { DiscordChatService } from "@core/services/DiscordChatService.js";
import { oneIn, randomArrayItem } from "@core/utils/probabilityUtils.js";
import { getConfig } from "@infrastructure/config/Config.js";
import type { GeminiLlmService } from "@infrastructure/services/GeminiLlmService.js";
import type { Message, MessageReaction, PartialMessageReaction, PartialUser, TextChannel, User } from "discord.js";

export type AutoReactionService = {
    readonly reactionAdded: (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => Promise<void>;
    readonly messageCreated: (message: Message) => Promise<void>;
};

export type AutoReactionServiceDeps = {
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

//Listens for various events the bot can react and respond to.
export const createAutoReactionService = ({ discordChatService, geminiLlmService, llmInstructionRepo }: AutoReactionServiceDeps): AutoReactionService => {
    console.log("[AutoReactionService] Creating AutoReactionService");

    const botId = getConfig().discord.clientId;

    async function checkForFunnySubstrings(message: Message): Promise<void> {
        if (message.author.id === botId) return;

        const substrings = ["69420", "69", "420"];

        //Finds the first substring and the 3 words before and after it.
        const regex = new RegExp(`\\b(?:\\w+\\b\\W+){0,3}\\w*(${substrings.join("|")})\\w*(?:\\W+\\b\\w+\\b){0,3}`, "gi");
        const matches = message.content.match(regex);

        if (matches) {
            const match = matches[0];

            const highlightRegex = new RegExp(`(${substrings.join("|")})`, "gi");
            const highlighted = match.replace(highlightRegex, "**$1**");

            await message.reply(`> ${highlighted}\nNice`);
        }
    }

    function findLastWordEndingWithEr(sentence: string) {
        const words = sentence.trim().split(/\s+/);
        let lastWord = words[words.length - 1];

        if (!lastWord) return;

        //Remove trailing punctuation
        lastWord = lastWord.replace(/[.,!?;:]+$/, "");

        //Check if it ends with "er" (case-insensitive)
        if (/er$/i.test(lastWord)) {
            return lastWord;
        }

        return undefined;
    }

    async function tryToSayErJoke(message: Message) {
        if (message.author.id === botId) return;

        const erWord = findLastWordEndingWithEr(message.content);
        if (erWord) {
            await message.reply(`"${erWord}"? I hardly know her!`);
        }
    }

    //Very small chance for the LLM to respond with the message but nekoized.
    async function tryToNekoizeMessage(message: Message) {
        const channel = (await message.channel.fetch()) as TextChannel;
        const controller = new AbortController();
        void discordChatService.sendTypingIndicator(controller.signal, channel);

        try {
            const content = await discordChatService.replaceUserAndRoleMentions(message);
            const systemInstruction = await llmInstructionRepo.getInstruction("nekoize");
            const response = await geminiLlmService.generateMessage(content, [], systemInstruction);
            await message.reply(response);
        } finally {
            controller.abort();
        }
    }

    return {
        reactionAdded: async (reaction, user): Promise<void> => {
            try {
                const message = await reaction.message.fetch();
                reaction = await reaction.fetch();

                if (message.author.id !== user.id) return;

                const scoldMessages = reactionScoldMessages[reaction.emoji.name!];
                if (!scoldMessages) return;

                await message.channel.send(`${randomArrayItem(scoldMessages)} <@${user.id}>`);
            } catch (e: unknown) {
                // Ignore errors when bot is being destroyed (token no longer available)
                if (!isClientDestroyedError(e)) {
                    console.error("Error checking if added reaction needs to be scolded", e);
                }
            }
        },

        messageCreated: async (message): Promise<void> => {
            await checkForFunnySubstrings(message);
            await tryToSayErJoke(message);

            if (oneIn(1000) && message.author.id !== botId && !process.env.CI) {
                await tryToNekoizeMessage(message);
            }
        },
    };
};
