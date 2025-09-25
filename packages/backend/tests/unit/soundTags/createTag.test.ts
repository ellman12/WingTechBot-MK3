import { createTestDb } from "../../utils/testUtils";
import { createSoundTagRepository } from "@adapters/repositories/SoundTagRepository";

describe("createTag", async () => {
    it("should create a tag successfully", async () => {
        const db = await createTestDb();
        const repo = createSoundTagRepository(db);

        const tag = await repo.create("music");
        expect(tag.name).toEqual("music");
    });

    it("should throw if invalid tag name", async () => {
        const db = await createTestDb();
        const repo = createSoundTagRepository(db);

        await (expect(repo.create(""))).rejects.toThrow();
        await (expect(repo.create("   "))).rejects.toThrow();
        await (expect(repo.create("music"))).resolves.toBeDefined();
    });

    it("should do nothing for duplicate tag names", async () => {
        const db = await createTestDb();
        const repo = createSoundTagRepository(db);

        const tag = await repo.create("music");
        expect(tag.name).toEqual("music");
        await expect(repo.create("music")).resolves.toBeDefined();
    });
});