import type { AutoSoundType } from "@db/types";

export type AutoSound = {
    readonly userId: string;
    readonly soundId: number;
    readonly soundName?: string; //Nullable because not everything needs it.
    readonly type: AutoSoundType;
};
