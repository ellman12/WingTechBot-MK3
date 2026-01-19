export const instructionTypes = ["generalChat", "nekoize", "discordStatus"] as const;
export type InstructionType = (typeof instructionTypes)[number];

export type LlmInstructionRepository = {
    readonly getInstructionPath: (instructionType: InstructionType) => string;
    readonly getInstruction: (instructionType: InstructionType) => Promise<string>;
    readonly instructionExists: (instructionType: InstructionType) => Promise<boolean>;
    readonly validateInstructions: () => Promise<void>;
};
