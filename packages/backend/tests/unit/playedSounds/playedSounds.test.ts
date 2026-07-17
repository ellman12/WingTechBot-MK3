import { createPlayedSoundsRepository } from "@adapters/repositories/PlayedSoundsRepository.js";
import { createSoundRepository } from "@adapters/repositories/SoundRepository.js";
import { createUserRepository } from "@adapters/repositories/UserRepository.js";

import { createFakeUsers, createTestDb } from "../../utils/testUtils.js";

const setUpTest = async () => {
    const db = await createTestDb();
    const users = createUserRepository(db);
    const sounds = createSoundRepository(db);
    const soundPlays = createPlayedSoundsRepository(db);

    await createFakeUsers(users, 3);

    await sounds.addSound({ name: "airhorn", path: "airhorn" });
    await sounds.addSound({ name: "sad-trombone", path: "sad-trombone" });
    await sounds.addSound({ name: "bones", path: "bones" });

    return { db, users, sounds, soundPlays };
};

describe.concurrent("getSoundPlayCounts", () => {
    test("returns an empty array when there are no plays", async () => {
        const { soundPlays } = await setUpTest();
        const leaderboard = await soundPlays.getSoundPlayCounts();
        expect(leaderboard).toEqual([]);
    });

    test("orders sounds by play count descending", async () => {
        const source = "Command";
        const { soundPlays } = await setUpTest();

        await soundPlays.addPlayedSound({ userId: "111", soundId: 1, source });
        await soundPlays.addPlayedSound({ userId: "222", soundId: 1, source });
        await soundPlays.addPlayedSound({ userId: "333", soundId: 2, source });

        const leaderboard = await soundPlays.getSoundPlayCounts();
        expect(leaderboard).toHaveLength(2);
        expect(leaderboard[0]).toMatchObject({ id: 1, name: "airhorn", playCount: 2 });
        expect(leaderboard[1]).toMatchObject({ id: 2, name: "sad-trombone", playCount: 1 });
    });

    test("respects the limit parameter", async () => {
        const source = "VoiceEvent";
        const { soundPlays } = await setUpTest();

        await soundPlays.addPlayedSound({ userId: "111", soundId: 1, source });
        await soundPlays.addPlayedSound({ userId: "111", soundId: 2, source });
        await soundPlays.addPlayedSound({ userId: "111", soundId: 3, source });

        const leaderboard = await soundPlays.getSoundPlayCounts(2);
        expect(leaderboard).toHaveLength(2);
    });

    test("only counts plays from the given year", async () => {
        const source = "Command";
        const { db, soundPlays } = await setUpTest();

        await db
            .insertInto("played_sounds")
            .values([
                { user_id: "111", sound_id: 1, source, played_at: new Date("2025-06-01T00:00:00Z") },
                { user_id: "111", sound_id: 1, source, played_at: new Date("2025-06-02T00:00:00Z") },
                { user_id: "111", sound_id: 2, source, played_at: new Date("2024-06-01T00:00:00Z") },
            ])
            .execute();

        const leaderboard = await soundPlays.getSoundPlayCounts(15, undefined, 2025);
        expect(leaderboard).toHaveLength(1);
        expect(leaderboard[0]).toMatchObject({ id: 1, name: "airhorn", playCount: 2 });
    });
});

describe.concurrent("getSoundPlayCount", () => {
    test("returns 0 for a sound with no plays", async () => {
        const { soundPlays } = await setUpTest();
        const count = await soundPlays.getSoundPlayCount(999);
        expect(count).toBe(0);
    });

    test("returns the correct count after multiple plays", async () => {
        const source = "Command";
        const { soundPlays } = await setUpTest();

        for (const userId of ["111", "222", "333"]) {
            await soundPlays.addPlayedSound({ userId, soundId: 1, source });
        }

        const count = await soundPlays.getSoundPlayCount(1);
        expect(count).toBe(3);
    });

    test("only counts plays from the given year", async () => {
        const source = "Command";
        const { db, soundPlays } = await setUpTest();

        await db
            .insertInto("played_sounds")
            .values([
                { user_id: "111", sound_id: 1, source, played_at: new Date("2025-01-15T00:00:00Z") },
                { user_id: "111", sound_id: 1, source, played_at: new Date("2023-12-31T23:59:59Z") },
                { user_id: "111", sound_id: 1, source, played_at: new Date("2026-01-01T00:00:00Z") },
            ])
            .execute();

        const count = await soundPlays.getSoundPlayCount(1, undefined, 2025);
        expect(count).toBe(1);
    });

    test("only counts plays from the given user", async () => {
        const source = "Command";
        const { soundPlays } = await setUpTest();

        await soundPlays.addPlayedSound({ userId: "111", soundId: 1, source });
        await soundPlays.addPlayedSound({ userId: "111", soundId: 1, source });
        await soundPlays.addPlayedSound({ userId: "222", soundId: 1, source });

        const count = await soundPlays.getSoundPlayCount(1, "111");
        expect(count).toBe(2);
    });

    test("combines the year and user filters", async () => {
        const source = "Command";
        const { db, soundPlays } = await setUpTest();

        await db
            .insertInto("played_sounds")
            .values([
                { user_id: "111", sound_id: 1, source, played_at: new Date("2025-01-15T00:00:00Z") },
                { user_id: "111", sound_id: 1, source, played_at: new Date("2024-01-15T00:00:00Z") },
                { user_id: "222", sound_id: 1, source, played_at: new Date("2025-01-15T00:00:00Z") },
            ])
            .execute();

        const count = await soundPlays.getSoundPlayCount(1, "111", 2025);
        expect(count).toBe(1);
    });
});
