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

const source = "Command";

describe.concurrent("getSoundPlayCounts", () => {
    test("returns an empty array when there are no plays", async () => {
        const { soundPlays } = await setUpTest();
        const leaderboard = await soundPlays.getSoundPlayCounts();
        expect(leaderboard).toEqual([]);
    });

    test("orders sounds by play count descending", async () => {
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
        const { soundPlays } = await setUpTest();

        await soundPlays.addPlayedSound({ userId: "111", soundId: 1, source });
        await soundPlays.addPlayedSound({ userId: "111", soundId: 2, source });
        await soundPlays.addPlayedSound({ userId: "111", soundId: 3, source });

        const leaderboard = await soundPlays.getSoundPlayCounts(2);
        expect(leaderboard).toHaveLength(2);
    });

    test("only counts plays from the given year", async () => {
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
        const { soundPlays } = await setUpTest();

        for (const userId of ["111", "222", "333"]) {
            await soundPlays.addPlayedSound({ userId, soundId: 1, source });
        }

        const count = await soundPlays.getSoundPlayCount(1);
        expect(count).toBe(3);
    });

    test("only counts plays from the given year", async () => {
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
        const { soundPlays } = await setUpTest();

        await soundPlays.addPlayedSound({ userId: "111", soundId: 1, source });
        await soundPlays.addPlayedSound({ userId: "111", soundId: 1, source });
        await soundPlays.addPlayedSound({ userId: "222", soundId: 1, source });

        const count = await soundPlays.getSoundPlayCount(1, "111");
        expect(count).toBe(2);
    });

    test("combines the year and user filters", async () => {
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

describe.concurrent("getSoundPlayedDates", () => {
    test("returns an empty array when there are no plays", async () => {
        const { soundPlays } = await setUpTest();

        const dates = await soundPlays.getSoundPlayedDates();
        expect(dates).toEqual([]);
    });

    test("returns the oldest and newest played_at for a sound with multiple plays", async () => {
        const { db, soundPlays } = await setUpTest();

        await db
            .insertInto("played_sounds")
            .values([
                { user_id: "111", sound_id: 1, source, played_at: new Date("2025-01-01T00:00:00Z") },
                { user_id: "111", sound_id: 1, source, played_at: new Date("2025-06-15T00:00:00Z") },
                { user_id: "111", sound_id: 1, source, played_at: new Date("2025-03-10T00:00:00Z") },
            ])
            .execute();

        const dates = await soundPlays.getSoundPlayedDates();
        expect(dates).toHaveLength(1);
        expect(dates[0]).toMatchObject({ id: 1, oldestDate: new Date("2025-01-01T00:00:00Z"), latestDate: new Date("2025-06-15T00:00:00Z") });
    });

    test("excludes sounds that have never been played", async () => {
        const { db, soundPlays } = await setUpTest();

        await db
            .insertInto("played_sounds")
            .values({ user_id: "111", sound_id: 1, source, played_at: new Date("2025-01-01T00:00:00Z") })
            .execute();

        const dates = await soundPlays.getSoundPlayedDates();
        expect(dates).toHaveLength(1);
        expect(dates[0]!.id).toBe(1);
    });

    test("orders sounds by newest played_at descending", async () => {
        const { db, soundPlays } = await setUpTest();

        await db
            .insertInto("played_sounds")
            .values([
                { user_id: "111", sound_id: 1, source, played_at: new Date("2025-01-01T00:00:00Z") },
                { user_id: "111", sound_id: 2, source, played_at: new Date("2025-06-15T00:00:00Z") },
            ])
            .execute();

        const dates = await soundPlays.getSoundPlayedDates();
        expect(dates.map(d => d.id)).toEqual([2, 1]);
    });

    test("breaks ties in latest_date by ordering names ascending", async () => {
        const { db, soundPlays } = await setUpTest();
        const tiedDate = new Date("2025-01-01T00:00:00Z");

        await db
            .insertInto("played_sounds")
            .values([
                { user_id: "111", sound_id: 3, source, played_at: tiedDate }, // "bones"
                { user_id: "111", sound_id: 1, source, played_at: tiedDate }, // "airhorn"
            ])
            .execute();

        const dates = await soundPlays.getSoundPlayedDates();
        expect(dates.map(d => d.name)).toEqual(["airhorn", "bones"]);
    });

    test("filters to only the given userId when provided", async () => {
        const { db, soundPlays } = await setUpTest();

        await db
            .insertInto("played_sounds")
            .values([
                { user_id: "111", sound_id: 1, source, played_at: new Date("2025-01-01T00:00:00Z") },
                { user_id: "222", sound_id: 2, source, played_at: new Date("2025-02-01T00:00:00Z") },
            ])
            .execute();

        const dates = await soundPlays.getSoundPlayedDates("111");
        expect(dates).toHaveLength(1);
        expect(dates[0]!.id).toBe(1);
    });

    test("aggregates oldest/newest only from the given userId's plays", async () => {
        const { db, soundPlays } = await setUpTest();

        await db
            .insertInto("played_sounds")
            .values([
                // user 111's plays of sound 1 span Feb - Mar
                { user_id: "111", sound_id: 1, source, played_at: new Date("2025-02-01T00:00:00Z") },
                { user_id: "111", sound_id: 1, source, played_at: new Date("2025-03-01T00:00:00Z") },
                // user 222 also played sound 1, outside that range - should be excluded when filtering to 111
                { user_id: "222", sound_id: 1, source, played_at: new Date("2025-01-01T00:00:00Z") },
                { user_id: "222", sound_id: 1, source, played_at: new Date("2025-12-01T00:00:00Z") },
            ])
            .execute();

        const dates = await soundPlays.getSoundPlayedDates("111");
        expect(dates).toHaveLength(1);
        expect(dates[0]).toMatchObject({ id: 1, oldestDate: new Date("2025-02-01T00:00:00Z"), latestDate: new Date("2025-03-01T00:00:00Z") });
    });

    test("returns an empty array when the given userId has no plays", async () => {
        const { db, soundPlays } = await setUpTest();

        await db
            .insertInto("played_sounds")
            .values({ user_id: "111", sound_id: 1, source, played_at: new Date("2025-01-01T00:00:00Z") })
            .execute();

        const dates = await soundPlays.getSoundPlayedDates("999");
        expect(dates).toEqual([]);
    });

    test("filters to only the given year when provided", async () => {
        const { db, soundPlays } = await setUpTest();
        await db
            .insertInto("played_sounds")
            .values([
                { user_id: "111", sound_id: 1, source, played_at: new Date("2024-06-01T00:00:00Z") },
                { user_id: "111", sound_id: 2, source, played_at: new Date("2025-06-01T00:00:00Z") },
            ])
            .execute();

        const dates = await soundPlays.getSoundPlayedDates(undefined, 2025);
        expect(dates).toHaveLength(1);
        expect(dates[0]!.id).toBe(2);
    });

    test("aggregates oldest/newest only from plays within the given year", async () => {
        const { db, soundPlays } = await setUpTest();

        await db
            .insertInto("played_sounds")
            .values([
                { user_id: "111", sound_id: 1, source, played_at: new Date("2024-12-31T23:59:59Z") },
                { user_id: "111", sound_id: 1, source, played_at: new Date("2025-01-15T00:00:00Z") },
                { user_id: "111", sound_id: 1, source, played_at: new Date("2025-11-20T00:00:00Z") },
                { user_id: "111", sound_id: 1, source, played_at: new Date("2026-01-01T00:00:00Z") },
            ])
            .execute();

        const dates = await soundPlays.getSoundPlayedDates(undefined, 2025);
        expect(dates).toHaveLength(1);
        expect(dates[0]).toMatchObject({
            id: 1,
            oldestDate: new Date("2025-01-15T00:00:00Z"),
            latestDate: new Date("2025-11-20T00:00:00Z"),
        });
    });

    test("returns an empty array when no plays fall in the given year", async () => {
        const { db, soundPlays } = await setUpTest();

        await db
            .insertInto("played_sounds")
            .values({ user_id: "111", sound_id: 1, source, played_at: new Date("2025-01-01T00:00:00Z") })
            .execute();

        const dates = await soundPlays.getSoundPlayedDates(undefined, 1999);
        expect(dates).toEqual([]);
    });

    test("combines userId and year filters together", async () => {
        const { db, soundPlays } = await setUpTest();

        await db
            .insertInto("played_sounds")
            .values([
                // matches both filters
                { user_id: "111", sound_id: 1, source, played_at: new Date("2025-05-01T00:00:00Z") },
                // wrong user, right year
                { user_id: "222", sound_id: 2, source, played_at: new Date("2025-05-01T00:00:00Z") },
                // right user, wrong year
                { user_id: "111", sound_id: 3, source, played_at: new Date("2024-05-01T00:00:00Z") },
            ])
            .execute();

        const dates = await soundPlays.getSoundPlayedDates("111", 2025);
        expect(dates).toHaveLength(1);
        expect(dates[0]!.id).toBe(1);
    });
});
