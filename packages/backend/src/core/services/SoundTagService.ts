import type { SoundTag } from "@core/entities/SoundTag.js";
import type { SoundRepository } from "@core/repositories/SoundRepository.js";
import type { SoundTagRepository } from "@core/repositories/SoundTagRepository.js";
import type { UnitOfWork } from "@core/repositories/UnitOfWork.js";

export type SoundTagService = {
    readonly addTagToSound: (soundName: string, tagName: string) => Promise<boolean>;
    readonly removeTagFromSound: (soundName: string, tagName: string) => Promise<boolean>;
    readonly listTags: () => Promise<SoundTag[]>;
};

export type SoundTagServiceDeps = {
    readonly unitOfWork: UnitOfWork;
    readonly soundRepository: SoundRepository;
    readonly soundTagRepository: SoundTagRepository;
};

export const createSoundTagService = ({ unitOfWork, soundRepository, soundTagRepository }: SoundTagServiceDeps): SoundTagService => {
    return {
        addTagToSound: async (soundName, tagName): Promise<boolean> => {
            const sound = await soundRepository.getSoundByName(soundName);
            if (!sound || !sound.id) {
                console.error("Sound not found");
                return false;
            }

            // Extract sound.id to ensure TypeScript knows it's defined in the closure
            const soundId = sound.id;

            try {
                // Use transaction to ensure tag creation and assignment are atomic
                await unitOfWork.execute(async repos => {
                    // Use transaction-scoped soundTagRepository
                    let tag = await repos.soundTagRepository.getTagByName(tagName);
                    if (!tag) {
                        tag = await repos.soundTagRepository.create(tagName);
                    }

                    if (!tag.id) {
                        throw new Error("Tag ID is undefined after creation");
                    }

                    await repos.soundTagRepository.addTagToSound(soundId, tag.id);
                });
                return true;
            } catch (e: unknown) {
                console.error(`Error adding tag ${tagName} to ${soundName}`, e);
                return false;
            }
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

        listTags: async (): Promise<SoundTag[]> => {
            return await soundTagRepository.getAllTags();
        },
    };
};
