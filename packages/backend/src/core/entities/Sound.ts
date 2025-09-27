import type { SoundTag } from "@core/entities/SoundTag";

export type Sound = {
    readonly name: string;
    readonly path: string;
    readonly soundtags?: SoundTag[];
};
