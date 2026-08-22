import type { SoundTag } from "@core/entities/SoundTag.js";

export type Sound = {
    readonly id?: number; //Not required because not everything needs the id.
    readonly name: string;
    readonly path: string;
    readonly soundtags?: SoundTag[];
};

export const MAX_SOUND_NAME_LENGTH = 64;

//Sound names become file names on disk, so only allow an explicit safe character set.
//Callers lowercase the name before validating, and the lowercased name is what gets used,
//so uppercase letters are intentionally not part of this allowlist.
const SAFE_SOUND_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

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

    if (name.length === 0) {
        return `Sound names cannot be empty.`;
    }

    if (name.length > MAX_SOUND_NAME_LENGTH) {
        return `Sound names cannot be longer than ${MAX_SOUND_NAME_LENGTH} characters.`;
    }

    if (!SAFE_SOUND_NAME_PATTERN.test(name)) {
        return `Sound names can only contain lowercase letters, numbers, hyphens and underscores, and must start with a letter or number.`;
    }

    return undefined;
};
