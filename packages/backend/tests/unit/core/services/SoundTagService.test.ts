import { createUnitOfWork } from "@adapters/repositories/KyselyUnitOfWork";
import { createSoundRepository } from "@adapters/repositories/SoundRepository";
import { createSoundTagRepository } from "@adapters/repositories/SoundTagRepository";
import { createSoundTagService } from "@core/services/SoundTagService";

import { createTestDb } from "../../../utils/testUtils";
import { createSound } from "../../soundTags/addTagToSound.test";
import { createTag } from "../../soundTags/createTag.test";

describe.concurrent("SoundTagService", async () => {
    it("should add sound tags when they exist", async () => {
        const db = await createTestDb();
        const unitOfWork = createUnitOfWork(db);
        const soundRepository = createSoundRepository(db);
        const soundTagRepository = createSoundTagRepository(db);
        const service = createSoundTagService({ unitOfWork, soundRepository, soundTagRepository });

        const sound = await createSound(soundRepository);
        const tag = await createTag(soundTagRepository, "music");
        expect(await service.addTagToSound(sound.name, tag.name)).toBeTruthy();
    });

    it("should create sound tags when adding them, if needed", async () => {
        const db = await createTestDb();
        const unitOfWork = createUnitOfWork(db);
        const soundRepository = createSoundRepository(db);
        const soundTagRepository = createSoundTagRepository(db);
        const service = createSoundTagService({ unitOfWork, soundRepository, soundTagRepository });

        const sound = await createSound(soundRepository);
        expect(await service.addTagToSound(sound.name, "music")).toBeTruthy();
    });

    it("should return false for nonexistent sounds", async () => {
        const db = await createTestDb();
        const unitOfWork = createUnitOfWork(db);
        const soundRepository = createSoundRepository(db);
        const soundTagRepository = createSoundTagRepository(db);
        const service = createSoundTagService({ unitOfWork, soundRepository, soundTagRepository });

        expect(await service.addTagToSound("i don't exist", "music")).toBeFalsy();
    });

    it("should remove existing tags from sounds properly", async () => {
        const db = await createTestDb();
        const unitOfWork = createUnitOfWork(db);
        const soundRepository = createSoundRepository(db);
        const soundTagRepository = createSoundTagRepository(db);
        const service = createSoundTagService({ unitOfWork, soundRepository, soundTagRepository });

        const sound = await createSound(soundRepository);
        expect(await service.addTagToSound(sound.name, "music")).toBeTruthy();
        expect(await service.removeTagFromSound(sound.name, "music")).toBeTruthy();
    });

    it("should return false for nonexistent sounds", async () => {
        const db = await createTestDb();
        const unitOfWork = createUnitOfWork(db);
        const soundRepository = createSoundRepository(db);
        const soundTagRepository = createSoundTagRepository(db);
        const service = createSoundTagService({ unitOfWork, soundRepository, soundTagRepository });

        expect(await service.removeTagFromSound("i don't exist", "music")).toBeFalsy();
    });

    it("should return false for nonexistent tags", async () => {
        const db = await createTestDb();
        const unitOfWork = createUnitOfWork(db);
        const soundRepository = createSoundRepository(db);
        const soundTagRepository = createSoundTagRepository(db);
        const service = createSoundTagService({ unitOfWork, soundRepository, soundTagRepository });

        expect(await service.removeTagFromSound("i don't exist", "i don't exist")).toBeFalsy();
    });
});
