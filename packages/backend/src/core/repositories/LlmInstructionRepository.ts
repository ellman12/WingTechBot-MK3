export type InstructionType = "generalChat";

export type LlmInstructionRepository = {
    readonly getInstruction: (instructionType: InstructionType) => Promise<string>;
};
