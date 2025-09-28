import type { SoundRepository } from "@core/repositories/SoundRepository";
import type { SoundTagRepository } from "@core/repositories/SoundTagRepository";

export type SoundTagService = {
    readonly addTagToSound: (soundName: string, tagName: string) => Promise<boolean>;
    readonly removeTagFromSound: (soundName: string, tagName: string) => Promise<boolean>;
};

export type SoundTagServiceDeps = {
    readonly soundRepository: SoundRepository;
    readonly soundTagRepository: SoundTagRepository;
};

export const createSoundTagService = ({ soundRepository, soundTagRepository }: SoundTagServiceDeps): SoundTagService => {
    return {
        addTagToSound: async (soundName, tagName): Promise<boolean> => {
            const sound = await soundRepository.getSoundByName(soundName);
            if (!sound || !sound.id) {
                console.error("Sound not found");
                return false;
            }

            let tag = await soundTagRepository.getTagByName(tagName);
            if (!tag) {
                tag = await soundTagRepository.create(tagName);
            }

            try {
                await soundTagRepository.addTagToSound(sound.id, tag.id);
                return true;
            } catch (e: unknown) {
                console.error(`Error adding tag ${tagName} to ${soundName}`, e);
            }

            return false;
        },

        removeTagFromSound: async (soundName, tagName): Promise<boolean> => {
            const sound = await soundRepository.getSoundByName(soundName);
            if (!sound || !sound.id) {
                console.error("Sound not found");
                return false;
            }

            const tag = await soundTagRepository.getTagByName(tagName);
            if (!tag) {
                console.error("Tag not found");
                return false;
            }

            try {
                await soundTagRepository.removeTagFromSound(sound.id, tag.id);
                return true;
            } catch (e: unknown) {
                console.error(`Error removing tag ${tagName} from ${soundName}`, e);
            }

            return false;
        },
    };
};
