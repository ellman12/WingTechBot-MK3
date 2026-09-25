//Features a user can be banned from. Canonical list; the DB enum must match (asserted in the adapter).
export const availableFeatures = ["LlmConversations", "Reactions", "Soundboard"] as const;
export type AvailableFeature = (typeof availableFeatures)[number];

export type BannedFeature = {
    readonly userId: string;
    readonly bannedById: string;
    readonly feature: AvailableFeature;
    readonly createdAt: Date;
};
