import type { AvailableFeatures } from "@db/types.js";

export type BannedFeature = {
    readonly userId: string;
    readonly bannedById: string;
    readonly feature: AvailableFeatures;
    readonly createdAt: Date;
};
