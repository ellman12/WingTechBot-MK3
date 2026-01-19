import { createBannedFeaturesRepository } from "@adapters/repositories/BannedFeaturesRepository.js";

import { createTestDb } from "../../utils/testUtils.js";

describe.concurrent("unbanFeatures", () => {
    test("successfully unbans a user", async () => {
        const db = await createTestDb();
        const bannedFeatures = createBannedFeaturesRepository(db);

        await bannedFeatures.banFeature("11111", "admin-1", "Reactions");

        await bannedFeatures.unbanFeature("11111", "Reactions");

        const result = await bannedFeatures.getBannedUsers();
        expect(result).toHaveLength(0);
    });

    test("throws for invalid userId", async () => {
        const db = await createTestDb();
        const bannedFeatures = createBannedFeaturesRepository(db);

        expect(bannedFeatures.unbanFeature("", "Reactions")).rejects.toThrow("Invalid ID");
    });
});
