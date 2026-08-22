import type { AvailableFeature, BannedFeature } from "@core/entities/BannedFeature.js";

export type BannedFeaturesRepository = {
    readonly banFeature: (userId: string, bannedById: string, feature: AvailableFeature) => Promise<BannedFeature>;
    readonly unbanFeature: (userId: string, feature: AvailableFeature) => Promise<void>;
    readonly isUserBanned: (userId: string, feature: AvailableFeature) => Promise<boolean>;
    readonly getBannedUsers: (feature?: AvailableFeature) => Promise<BannedFeature[]>;
};
