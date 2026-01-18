import { createBannedFeaturesRepository } from "@adapters/repositories/BannedFeaturesRepository.js";
import type { AvailableFeatures } from "@db/types.js";

import { createTestDb } from "../../utils/testUtils.js";

const bannedUsers: [string, AvailableFeatures][] = [
    ["1000", "Reactions"],
    ["2000", "Soundboard"],
    ["3000", "LlmConversations"],
];

const notBannedUsers: [string, AvailableFeatures][] = [
    ["4000", "Reactions"],
    ["5000", "Soundboard"],
];

const invalidUserIds: [string, AvailableFeatures][] = [
    ["", "Reactions"],
    ["   ", "Soundboard"],
];

describe.concurrent("isUserBanned, user is banned for feature", () => {
    test.each(bannedUsers)("userId=%s feature=%s", async (userId, feature) => {
        const db = await createTestDb();
        const bannedFeatures = createBannedFeaturesRepository(db);

        await bannedFeatures.banFeature(userId, "admin", feature);

        const isBanned = await bannedFeatures.isUserBanned(userId, feature);
        expect(isBanned).toBe(true);
    });
});

describe.concurrent("isUserBanned, user is not banned", () => {
    test.each(notBannedUsers)("userId=%s feature=%s", async (userId, feature) => {
        const db = await createTestDb();
        const bannedFeatures = createBannedFeaturesRepository(db);

        const isBanned = await bannedFeatures.isUserBanned(userId, feature);
        expect(isBanned).toBe(false);
    });
});

describe.concurrent("isUserBanned, user banned for different feature", () => {
    test("returns false when banned for another feature", async () => {
        const db = await createTestDb();
        const bannedFeatures = createBannedFeaturesRepository(db);

        await bannedFeatures.banFeature("1000", "admin", "Reactions");

        const isBanned = await bannedFeatures.isUserBanned("1000", "Soundboard");
        expect(isBanned).toBe(false);
    });
});

describe.concurrent("isUserBanned, throws for invalid userId", () => {
    test.each(invalidUserIds)("userId=%s feature=%s", async (userId, feature) => {
        const db = await createTestDb();
        const bannedFeatures = createBannedFeaturesRepository(db);

        await expect(bannedFeatures.isUserBanned(userId, feature)).rejects.toThrow("Invalid user ID");
    });
});
