import type { AvailableFeature, BannedFeature } from "@core/entities/BannedFeature.js";
import type { BannedFeaturesRepository } from "@core/ports/repositories/BannedFeaturesRepository.js";
import type { Equals } from "@core/utils/typeUtils.js";
import type { BannedFeatures, DB, AvailableFeatures as DbAvailableFeatures } from "@db/types.js";
import type { Kysely, Selectable } from "kysely";

//The core enum is canonical; this fails to compile if the DB enum (kysely-codegen) drifts from it.
const _featureEnumsMatch: Equals<AvailableFeature, DbAvailableFeatures> = true;
void _featureEnumsMatch;

export const transformBannedFeature = (dbBannedFeature: Selectable<BannedFeatures>): BannedFeature => {
    return {
        userId: dbBannedFeature.user_id,
        bannedById: dbBannedFeature.banned_by_id,
        feature: dbBannedFeature.feature,
        createdAt: dbBannedFeature.created_at,
    };
};

export const createBannedFeaturesRepository = (db: Kysely<DB>): BannedFeaturesRepository => {
    console.log("[BannedFeaturesRepository] Initializing");

    const banFeature = async (userId: string, bannedById: string, feature: AvailableFeature): Promise<BannedFeature> => {
        if (userId.trim() === "" || bannedById.trim() === "") throw new Error("Invalid ID");

        const data = { user_id: userId, banned_by_id: bannedById, feature };

        const result = await db
            .insertInto("banned_features")
            .values(data)
            .onConflict(oc => oc.columns(["user_id", "banned_by_id", "feature"]).doNothing())
            .returningAll()
            .executeTakeFirstOrThrow();

        return transformBannedFeature(result);
    };

    const unbanFeature = async (userId: string, feature: AvailableFeature): Promise<void> => {
        if (userId.trim() === "") throw new Error("Invalid ID");

        await db.deleteFrom("banned_features").where("user_id", "=", userId).where("feature", "=", feature).executeTakeFirst();
    };

    const isUserBanned = async (userId: string, feature: AvailableFeature): Promise<boolean> => {
        if (userId.trim() === "") throw new Error("Invalid user ID");

        const result = await db.selectFrom("banned_features").where("user_id", "=", userId).where("feature", "=", feature).selectAll().executeTakeFirst();

        return result !== undefined;
    };

    const getBannedUsers = async (feature?: AvailableFeature): Promise<BannedFeature[]> => {
        const result = await db
            .selectFrom("banned_features")
            .selectAll()
            .$if(feature !== undefined, qb => qb.where("feature", "=", feature!))
            .orderBy("created_at")
            .execute();

        return result.map(transformBannedFeature);
    };

    return {
        banFeature,
        unbanFeature,
        isUserBanned,
        getBannedUsers,
    };
};
