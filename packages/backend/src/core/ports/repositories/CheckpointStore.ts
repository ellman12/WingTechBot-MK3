//Key-value store for resumable progress. Values round-trip through JSON, so Dates come back as strings.
export type CheckpointStore = {
    readonly load: <T>(key: string) => Promise<T | null>;
    readonly save: <T>(key: string, value: T) => Promise<void>;
    //Missing keys are ignored.
    readonly clear: (key: string) => Promise<void>;
};
