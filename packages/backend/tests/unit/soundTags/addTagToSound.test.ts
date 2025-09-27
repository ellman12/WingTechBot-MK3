import { createSoundRepository } from "@adapters/repositories/SoundRepository";
import { createSoundTagRepository } from "@adapters/repositories/SoundTagRepository";
import type { Sound } from "@core/entities/Sound";
import type { SoundRepository } from "@core/repositories/SoundRepository";

import { createTestDb } from "../../utils/testUtils";
import { createTag } from "./createTag.test";

export const sharedSound: Sound = { name: "sound1", path: "path/to/sound1", soundtags: [] };

export async function createSound(soundRepo: SoundRepository) {
    const sound = await soundRepo.addSound(sharedSound);
    expect(sound).toEqual(sharedSound);
    return sound;
}

describe("addTagToSound", async () => {
    it("should add a tag successfully", async () => {
        const db = await createTestDb();
        const sounds = createSoundRepository(db);
        const soundTags = createSoundTagRepository(db);

        await createSound(sounds);
        await createTag(soundTags, "short-sounds");

        await soundTags.addTagToSound(1, 1);
        const allTags = await soundTags.getAllTags();
        expect(allTags).toHaveLength(1);
    });

    it("should throw for invalid IDs", async () => {
        const db = await createTestDb();
        const sounds = createSoundRepository(db);
        const soundTags = createSoundTagRepository(db);

        await createSound(sounds);

        await expect(soundTags.addTagToSound(0, 123)).rejects.toThrow();
        await expect(soundTags.addTagToSound(456, 0)).rejects.toThrow();
        await expect(soundTags.addTagToSound(-1, 0)).rejects.toThrow();
    });

    it("should throw for missing IDs", async () => {
        const db = await createTestDb();
        const soundTags = createSoundTagRepository(db);

        await expect(soundTags.addTagToSound(123, 456)).rejects.toThrow();
    });
});
