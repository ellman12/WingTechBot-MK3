import { createSoundTagRepository } from "@adapters/repositories/SoundTagRepository.js";
import type { SoundTagRepository } from "@core/repositories/SoundTagRepository.js";

import { createTestDb } from "../../utils/testUtils.js";

export async function createTag(tagsRepo: SoundTagRepository, name: string) {
    const tag = await tagsRepo.create(name);
    expect(tag.name).toEqual(name);
    return tag;
}

describe.concurrent("createTag", async () => {
    it("should create a tag successfully", async () => {
        const db = await createTestDb();
        const repo = createSoundTagRepository(db);

        const tag = await repo.create("music");
        expect(tag.name).toEqual("music");
    });

    it("should throw if invalid tag name", async () => {
        const db = await createTestDb();
        const repo = createSoundTagRepository(db);

        await expect(repo.create("")).rejects.toThrow();
        await expect(repo.create("   ")).rejects.toThrow();
        await expect(repo.create("music")).resolves.toBeDefined();
    });

    it("should do nothing for duplicate tag names", async () => {
        const db = await createTestDb();
        const repo = createSoundTagRepository(db);

        await createTag(repo, "music");
        await expect(repo.create("music")).resolves.toBeDefined();
    });
});
