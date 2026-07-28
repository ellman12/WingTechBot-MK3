import { createUnitOfWork } from "@adapters/repositories/KyselyUnitOfWork.js";
import { createSoundRepository } from "@adapters/repositories/SoundRepository.js";
import { createSoundTagRepository } from "@adapters/repositories/SoundTagRepository.js";
import { createSoundTagService } from "@core/services/SoundTagService.js";

import { createTestDb } from "../../../utils/testUtils.js";
import { createSound } from "../../soundTags/addTagToSound.test";
import { createTag } from "../../soundTags/createTag.test";

const setUpTest = async () => {
    const db = await createTestDb();
    const unitOfWork = createUnitOfWork(db);
    const soundRepository = createSoundRepository(db);
    const soundTagRepository = createSoundTagRepository(db);
    const service = createSoundTagService({ unitOfWork, soundRepository, soundTagRepository });
    return { db, unitOfWork, soundRepository, soundTagRepository, service };
};

describe.concurrent("SoundTagService", async () => {
    it("should add sound tags when they exist", async () => {
        const { soundRepository, soundTagRepository, service } = await setUpTest();

        const sound = await createSound(soundRepository);
        const tag = await createTag(soundTagRepository, "music");
        expect(await service.addTagToSound(sound.name, tag.name)).toBeTruthy();
    });

    it("should create sound tags when adding them, if needed", async () => {
        const { soundRepository, soundTagRepository, service } = await setUpTest();

        expect(await soundTagRepository.getAllTags()).toHaveLength(0);

        const sound = await createSound(soundRepository);
        expect(await service.addTagToSound(sound.name, "music")).toBeTruthy();
    });

    it("should return false for nonexistent sounds", async () => {
        const { service } = await setUpTest();

        expect(await service.addTagToSound("i don't exist", "music")).toBeFalsy();
    });

    it("should remove existing tags from sounds properly", async () => {
        const { soundRepository, service } = await setUpTest();

        const sound = await createSound(soundRepository);
        expect(await service.addTagToSound(sound.name, "music")).toBeTruthy();
        expect(await service.removeTagFromSound(sound.name, "music")).toBeTruthy();
    });

    it("should return false for nonexistent sounds", async () => {
        const { service } = await setUpTest();

        expect(await service.removeTagFromSound("i don't exist", "music")).toBeFalsy();
    });

    it("should return false for nonexistent tags", async () => {
        const { service } = await setUpTest();

        expect(await service.removeTagFromSound("i don't exist", "i don't exist")).toBeFalsy();
    });
});
