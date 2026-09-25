import type { SoundRepository } from "@core/ports/repositories/SoundRepository.js";
import type { SoundTagRepository } from "@core/ports/repositories/SoundTagRepository.js";

export type AutocompleteChoice = {
    readonly name: string;
    readonly value: string;
};

export type CommandChoicesService = {
    readonly getAutocompleteChoices: (fieldName: string, focusedValue: string) => Promise<AutocompleteChoice[]>;
};

export type CommandChoicesServiceDeps = {
    readonly soundRepository: SoundRepository;
    readonly soundTagRepository: SoundTagRepository;
};

export const createCommandChoicesService = ({ soundRepository, soundTagRepository }: CommandChoicesServiceDeps): CommandChoicesService => {
    async function getAutocompleteChoices(fieldName: string, focusedValue: string): Promise<AutocompleteChoice[]> {
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
