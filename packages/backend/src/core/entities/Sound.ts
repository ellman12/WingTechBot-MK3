import type { SoundTag } from "@core/entities/SoundTag.js";

export type Sound = {
    readonly id?: number; //Not required because not everything needs the id.
    readonly name: string;
    readonly path: string;
    readonly soundtags?: SoundTag[];
};
