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
            "audio-source": () => (focusedValue === "" ? soundRepository.getAllSounds() : soundRepository.tryGetSoundsWithinDistance(focusedValue)),
            "tag-name": () => (focusedValue === "" ? soundTagRepository.getAllTags() : soundTagRepository.tryGetTagsWithinDistance(focusedValue)),
        };

        const handler = handlers[fieldName];
        if (!handler) return [];

        const results = await handler();
        return results.map(({ name }) => ({ name, value: name }));
    }

    return { getAutocompleteChoices };
};
