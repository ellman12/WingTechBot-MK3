import type { FileManager } from "@core/services/FileManager";

export const instructionTypes = ["generalChat", "nekoize"] as const;
export type InstructionType = (typeof instructionTypes)[number];

export type LlmInstructionRepository = {
    readonly getInstructionPath: (instructionType: InstructionType) => string;
    readonly getInstruction: (instructionType: InstructionType) => Promise<string>;
    readonly instructionExists: (instructionType: InstructionType) => Promise<boolean>;
    readonly validateInstructions: () => Promise<void>;
};

export const createLlmInstructionRepository = (fileManager: FileManager): LlmInstructionRepository => {
    const getInstructionPath = (instructionType: InstructionType): string => {
        return `./llmInstructions/${instructionType}.txt`;
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
