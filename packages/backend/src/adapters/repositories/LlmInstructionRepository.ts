import type { Config } from "@core/config/Config.js";
import { type InstructionType, type LlmInstructionRepository, instructionTypes } from "@core/repositories/LlmInstructionRepository.js";
import type { FileManager } from "@core/services/FileManager.js";
import { join } from "path";

export type LlmInstructionRepositoryDeps = {
    readonly config: Config;
    readonly fileManager: FileManager;
};

export const createLlmInstructionRepository = ({ config, fileManager }: LlmInstructionRepositoryDeps): LlmInstructionRepository => {
    const getInstructionPath = (instructionType: InstructionType): string => {
        return join(config.llm.instructionsPath, `${instructionType}.txt`);
    };

    const getInstruction = async (instructionType: InstructionType): Promise<string> => {
        return await fileManager.readFile(getInstructionPath(instructionType));
    };

    const instructionExists = async (instructionType: InstructionType): Promise<boolean> => {
        return await fileManager.fileExists(getInstructionPath(instructionType));
    };

    const validateInstructions = async () => {
        for (const type of instructionTypes) {
            if (!(await instructionExists(type))) {
                throw new Error(`LLM instruction for ${type} not found at ${getInstructionPath(type)}`);
            }
        }
    };

    return {
        getInstructionPath,
        getInstruction,
        instructionExists,
        validateInstructions,
    };
};
