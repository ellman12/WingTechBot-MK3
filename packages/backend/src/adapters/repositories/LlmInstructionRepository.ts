import { getConfig } from "@adapters/config/ConfigAdapter.js";
import type { FileManager } from "@core/services/FileManager.js";
import { join } from "path";

export const instructionTypes = ["generalChat", "nekoize", "discordStatus"] as const;
export type InstructionType = (typeof instructionTypes)[number];

export type LlmInstructionRepository = {
    readonly getInstructionPath: (instructionType: InstructionType) => string;
    readonly getInstruction: (instructionType: InstructionType) => Promise<string>;
    readonly instructionExists: (instructionType: InstructionType) => Promise<boolean>;
    readonly validateInstructions: () => Promise<void>;
};

export const createLlmInstructionRepository = (fileManager: FileManager): LlmInstructionRepository => {
    const config = getConfig();

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
