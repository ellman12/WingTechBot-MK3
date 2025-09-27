import type { SoundTag } from "@core/entities/SoundTag";

export type SoundTagRepository = {
    readonly create: (name: string) => Promise<SoundTag>;
    readonly getTagByName: (name: string) => Promise<SoundTag | null>;
    readonly addTagToSound: (soundId: number, tagId: number) => Promise<void>;
    readonly removeTagFromSound: (soundId: number, tagId: number) => Promise<void>;
    readonly getAllTags: () => Promise<SoundTag[]>;
};
