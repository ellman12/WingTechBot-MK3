import type { LlmInstructionRepository } from "@core/ports/repositories/LlmInstructionRepository.js";
import type { LlmService } from "@core/ports/services/LlmService.js";

export type BotStatusService = {
    //Generates the text shown as the bot's Discord activity/status.
    readonly generateStatus: () => Promise<string>;
};

export type BotStatusServiceDeps = {
    readonly llmService: LlmService;
    readonly llmInstructionRepo: LlmInstructionRepository;
};

export const createBotStatusService = ({ llmService, llmInstructionRepo }: BotStatusServiceDeps): BotStatusService => {
    async function generateStatus(): Promise<string> {
        const instruction = await llmInstructionRepo.getInstruction("discordStatus");
        return await llmService.generateStandaloneMessage(instruction);
    }

    return {
        generateStatus,
    };
};
