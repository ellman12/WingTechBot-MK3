import { createSoundRepository } from "@adapters/repositories/SoundRepository";
import { createVoiceEventsSoundsRepository } from "@adapters/repositories/VoiceEventSoundsRepository";

import { createTestDb } from "../../utils/testUtils";

describe("Add and Delete VoiceEventSounds", async () => {
    const userId = "1234";
    const type = "UserJoin";

    test("valid data", async () => {
        const db = await createTestDb();
        const soundsRepo = createSoundRepository(db);
        const voiceEventSoundsRepo = createVoiceEventsSoundsRepository(db);

        const sound = await soundsRepo.addSound({ name: "test_sound", path: "./" });
        const voiceEventSound = await voiceEventSoundsRepo.addVoiceEventSound(userId, sound.id!, type);
        let voiceEventSounds = await voiceEventSoundsRepo.getVoiceEventSounds({ userId, type });

        expect(voiceEventSounds).toHaveLength(1);
        expect(voiceEventSounds[0]!.userId).toEqual(userId);
        expect(voiceEventSounds[0]!.soundId).toEqual(voiceEventSound.soundId);

        await voiceEventSoundsRepo.deleteVoiceEventSound(userId, sound.id!, type);
        voiceEventSounds = await voiceEventSoundsRepo.getVoiceEventSounds({ userId, type });

        expect(voiceEventSounds).toHaveLength(0);
    });

    test("throws for invalid data", async () => {
        const db = await createTestDb();
        const soundsRepo = createSoundRepository(db);
        const voiceEventSoundsRepo = createVoiceEventsSoundsRepository(db);

        const sound = await soundsRepo.addSound({ name: "test_sound", path: "./" });

        await expect(voiceEventSoundsRepo.addVoiceEventSound("", sound.id!, type)).rejects.toThrow();
        await expect(voiceEventSoundsRepo.addVoiceEventSound(userId, -69, "UserLeave")).rejects.toThrow();
    });
});
