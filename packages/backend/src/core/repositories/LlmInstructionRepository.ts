export type InstructionType = "generalChat" | "nekoize";

export type LlmInstructionRepository = {
    readonly getInstruction: (instructionType: InstructionType) => Promise<string>;
};
