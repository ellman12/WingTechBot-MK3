import type { Config } from "@core/config/Config.js";
import { type InstructionType, type LlmInstructionRepository, instructionTypes } from "@core/ports/repositories/LlmInstructionRepository.js";
import fs from "fs";
import { join } from "path";

export type LlmInstructionRepositoryDeps = {
    readonly config: Config;
};

export const createLlmInstructionRepository = ({ config }: LlmInstructionRepositoryDeps): LlmInstructionRepository => {
    const getInstructionPath = (instructionType: InstructionType): string => {
        return join(config.llm.instructionsPath, `${instructionType}.txt`);
    };

    const getInstruction = async (instructionType: InstructionType): Promise<string> => {
        return await fs.promises.readFile(getInstructionPath(instructionType), "utf8");
    };

    const instructionExists = async (instructionType: InstructionType): Promise<boolean> => {
        try {
            await fs.promises.access(getInstructionPath(instructionType));
            return true;
        } catch {
            return false;
        }
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
