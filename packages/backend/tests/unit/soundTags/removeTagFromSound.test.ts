import { createSoundRepository } from "@adapters/repositories/SoundRepository";
import { createSoundTagRepository } from "@adapters/repositories/SoundTagRepository";

import { createTestDb } from "../../utils/testUtils";
import { createSound } from "./addTagToSound.test";
import { createTag } from "./createTag.test";

describe("removeTagFromSound", async () => {
    it("should remove a tag successfully", async () => {
        const db = await createTestDb();
        const sounds = createSoundRepository(db);
        const tags = createSoundTagRepository(db);

        await createSound(sounds);
        await createTag(tags, "sounds");
        await tags.addTagToSound(1, 1);
        expect(await tags.getAllTags()).toHaveLength(1);
        expect((await sounds.getAllSounds())[0]?.soundtags).toHaveLength(1);

        await tags.removeTagFromSound(1, 1);
        expect((await sounds.getAllSounds())[0]?.soundtags).toHaveLength(0);
    });

    it("should throw for invalid IDs", async () => {
        const db = await createTestDb();
        const tags = createSoundTagRepository(db);

        await expect(tags.removeTagFromSound(0, 123)).rejects.toThrow();
        await expect(tags.removeTagFromSound(456, 0)).rejects.toThrow();
        await expect(tags.removeTagFromSound(-1, 0)).rejects.toThrow();
    });
});
