import { createBannedFeaturesRepository } from "@adapters/repositories/BannedFeaturesRepository.js";

import { createTestDb } from "../../utils/testUtils.js";

describe.concurrent("getBannedUsers", () => {
    test("returns all banned users", async () => {
        const db = await createTestDb();
        const bannedFeatures = createBannedFeaturesRepository(db);

        await bannedFeatures.banFeature("11111111", "333333333", "Reactions");
        await bannedFeatures.banFeature("2222222222", "333333333", "LlmConversations");

        const result = await bannedFeatures.getBannedUsers();

        expect(result).toHaveLength(2);
        expect(result.map(r => r.userId)).toEqual(["11111111", "2222222222"]);
    });

    test("filters by feature", async () => {
        const db = await createTestDb();
        const bannedFeatures = createBannedFeaturesRepository(db);

        await bannedFeatures.banFeature("11111111", "333333333", "Reactions");
        await bannedFeatures.banFeature("2222222222", "333333333", "LlmConversations");

        const reactionsOnly = await bannedFeatures.getBannedUsers("Reactions");

        expect(reactionsOnly).toHaveLength(1);
        expect(reactionsOnly[0]!.feature).toBe("Reactions");
        expect(reactionsOnly[0]!.userId).toBe("11111111");
    });
});
