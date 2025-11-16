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
    async function getAutocompleteChoices(focusedOption: AutocompleteFocusedOption): Promise<ApplicationCommandOptionChoiceData[]> {
        const fieldName = focusedOption.name;
        const focusedValue = focusedOption.value;

        if (fieldName === "sound-name") {
            const sounds = focusedValue === "" ? await soundRepository.getAllSounds() : await soundRepository.tryGetSoundsWithinDistance(focusedValue);
            return sounds.map(s => ({ name: s.name, value: s.name }));
        }

        if (fieldName === "tag-name") {
            const tags = focusedValue === "" ? await soundTagRepository.getAllTags() : await soundTagRepository.tryGetTagsWithinDistance(focusedValue);
            return tags.map(t => ({ name: t.name, value: t.name }));
        }

        return [];
    }

    return {
        getAutocompleteChoices,
    };
};
