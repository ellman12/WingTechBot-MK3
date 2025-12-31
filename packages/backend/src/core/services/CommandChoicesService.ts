import type { SoundRepository } from "@core/repositories/SoundRepository.js";
import type { SoundTagRepository } from "@core/repositories/SoundTagRepository.js";
import type { ApplicationCommandOptionChoiceData, AutocompleteFocusedOption } from "discord.js";

export type CommandChoicesService = {
    readonly getAutocompleteChoices: (focusedOption: AutocompleteFocusedOption) => Promise<ApplicationCommandOptionChoiceData[]>;
};

export type CommandChoicesServiceDeps = {
    readonly soundRepository: SoundRepository;
    readonly soundTagRepository: SoundTagRepository;
};

export const createCommandChoicesService = ({ soundRepository, soundTagRepository }: CommandChoicesServiceDeps): CommandChoicesService => {
    async function getAutocompleteChoices({ name: fieldName, value: focusedValue }: AutocompleteFocusedOption): Promise<ApplicationCommandOptionChoiceData[]> {
        const handlers: Record<string, () => Promise<{ name: string }[]>> = {
            "sound-name": () => (focusedValue === "" ? soundRepository.getAllSounds() : soundRepository.tryGetSoundsWithinDistance(focusedValue)),
            "audio-source": async () => {
                // Special handling for audio-source to support tags, random, and sounds
                if (focusedValue.startsWith("#")) {
                    // User is typing a tag - show tag suggestions with # prefix
                    const tagSearch = focusedValue.substring(1);
                    const tags = tagSearch === "" ? await soundTagRepository.getAllTags() : await soundTagRepository.tryGetTagsWithinDistance(tagSearch);
                    return tags.map(tag => ({ name: `#${tag.name}` }));
                } else if (focusedValue === "" || focusedValue.toLowerCase().startsWith("r")) {
                    // Show "random" option along with sounds
                    const sounds = focusedValue === "" ? await soundRepository.getAllSounds() : await soundRepository.tryGetSoundsWithinDistance(focusedValue);
                    const results: { name: string }[] = [{ name: "random" }, ...sounds];
                    return results;
                } else {
                    // Normal sound search
                    return soundRepository.tryGetSoundsWithinDistance(focusedValue);
                }
            },
            "tag-name": () => (focusedValue === "" ? soundTagRepository.getAllTags() : soundTagRepository.tryGetTagsWithinDistance(focusedValue)),
        };

        const handler = handlers[fieldName];
        if (!handler) return [];

        const results = await handler();
        return results.map(({ name }) => ({ name, value: name }));
    }

    return { getAutocompleteChoices };
};
