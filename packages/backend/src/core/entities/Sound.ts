import type { SoundTag } from "@core/entities/SoundTag.js";

export type Sound = {
    readonly id?: number; //Not required because not everything needs the id.
    readonly name: string;
    readonly path: string;
    readonly soundtags?: SoundTag[];
};

//Validates a sound name against reserved names and special characters.
//Returns an error message if invalid, undefined if valid.
export const validateSoundName = (name: string): string | undefined => {
    if (name === "random") {
        return `Cannot use reserved name "random" for a sound.`;
    }

    if (name.startsWith("#")) {
        return `Cannot use names starting with "#" (reserved for tags).`;
    }

    if (name.includes(",")) {
        return `Cannot use commas in sound names (reserved for multi-sound selection).`;
    }

    if (name === "currently-playing") {
        return `Cannot use reserved name "currently-playing" for a sound.`;
    }

    return undefined;
};
