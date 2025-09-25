import { createTestDb } from "../../utils/testUtils";
import { createSoundRepository } from "@adapters/repositories/SoundRepository";
import { createSoundTagRepository } from "@adapters/repositories/SoundTagRepository";
import { expect } from "vitest";

describe("addTagToSound", async () => {


    it("should add a tag successfully", async () => {
        const db = await createTestDb();
        const sounds = createSoundRepository(db);
        const soundTags = createSoundTagRepository(db);

        const newSound = { name: "sound1", path: "path/to/sound1" };
        const soundResult = await sounds.addSound(newSound);
        expect(soundResult).toEqual(newSound);

        const newTag = "short-sounds";
        const tagResult = await soundTags.create(newTag);
        expect(tagResult.name).toEqual(newTag);

        await soundTags.addTagToSound(1, 1);
        const allTags = await soundTags.getAllTags();
        expect(allTags).toHaveLength(1);
    });
});