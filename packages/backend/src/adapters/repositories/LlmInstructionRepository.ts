import type { InstructionType, LlmInstructionRepository } from "@core/repositories/LlmInstructionRepository";
import type { FileManager } from "@core/services/FileManager";

export const createLlmInstructionRepository = (fileManager: FileManager): LlmInstructionRepository => {
    async function getSystemInstruction(instructionType: InstructionType): Promise<string> {
        return await fileManager.readFile(`./llmInstructions/${instructionType}.txt`);
    }

    return {
        getInstruction: getSystemInstruction,
    };
};
