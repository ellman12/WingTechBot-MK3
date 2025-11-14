import { createAutoSoundsRepository } from "@adapters/repositories/AutoSoundsRepository";
import { createSoundRepository } from "@adapters/repositories/SoundRepository";

import { createTestDb } from "../../utils/testUtils";

describe("Add and Delete AutoSounds", async () => {
    const userId = "1234";
    const type = "UserJoin";

    test("valid data", async () => {
        const db = await createTestDb();
        const soundsRepo = createSoundRepository(db);
        const autoSoundsRepo = createAutoSoundsRepository(db);

        const sound = await soundsRepo.addSound({ name: "test_sound", path: "./" });
        const autoSound = await autoSoundsRepo.addAutoSound(userId, sound.id!, type);
        let autoSounds = await autoSoundsRepo.getAutoSoundsForUser(userId, type);

        expect(autoSounds).toHaveLength(1);
        expect(autoSounds[0]!.userId).toEqual(userId);
        expect(autoSounds[0]!.soundId).toEqual(autoSound.soundId);

        await autoSoundsRepo.deleteAutoSound(userId, sound.id!, type);
        autoSounds = await autoSoundsRepo.getAutoSoundsForUser(userId, type);

        expect(autoSounds).toHaveLength(0);
    });

    test("throws for invalid data", async () => {
        const db = await createTestDb();
        const soundsRepo = createSoundRepository(db);
        const autoSoundsRepo = createAutoSoundsRepository(db);

        const sound = await soundsRepo.addSound({ name: "test_sound", path: "./" });

        await expect(autoSoundsRepo.addAutoSound("", sound.id!, type)).rejects.toThrow();
        await expect(autoSoundsRepo.addAutoSound(userId, -69, "UserLeave")).rejects.toThrow();
    });
});
