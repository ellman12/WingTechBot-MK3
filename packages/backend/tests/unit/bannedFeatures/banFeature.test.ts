import { createBannedFeaturesRepository } from "@adapters/repositories/BannedFeaturesRepository.js";
import type { AvailableFeatures } from "@db/types.js";

import { createTestDb } from "../../utils/testUtils.js";

const validBans: [string, string, AvailableFeatures][] = [
    ["1000", "1111", "Reactions"],
    ["2000", "1111", "Soundboard"],
    ["3000", "2111", "LlmConversations"],
];

const invalidBans: [string, string, AvailableFeatures][] = [
    ["", "1111", "Reactions"],
    ["1000", "", "Soundboard"],
    ["   ", "1111", "LlmConversations"],
];

describe.concurrent("banFeature, valid data", () => {
    test.each(validBans)("userId=%s bannedById=%s feature=%s", async (userId, bannedById, feature) => {
        const db = await createTestDb();
        const bannedFeatures = createBannedFeaturesRepository(db);

        const banned = await bannedFeatures.banFeature(userId, bannedById, feature);

        expect(banned.userId).toBe(userId);
        expect(banned.bannedById).toBe(bannedById);
        expect(banned.feature).toBe(feature);
        expect(banned.createdAt).toBeInstanceOf(Date);

        const allBanned = await bannedFeatures.getBannedUsers();
        expect(allBanned).toHaveLength(1);
        expect(allBanned[0]!.userId).toBe(userId);
    });
});

describe.concurrent("banFeature, throws for invalid input", () => {
    test.each(invalidBans)("userId=%s bannedById=%s feature=%s", async (userId, bannedById, feature) => {
        const db = await createTestDb();
        const bannedFeatures = createBannedFeaturesRepository(db);

        await expect(bannedFeatures.banFeature(userId, bannedById, feature)).rejects.toThrow("Invalid ID");
    });
});
