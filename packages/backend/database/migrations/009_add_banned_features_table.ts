import { Kysely, sql } from "kysely";

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
    await db.schema.createType("available_features").asEnum(["Reactions", "Soundboard", "LlmConversations"]).execute();

    await db.schema
        .createTable("banned_features")
        .addColumn("user_id", "text", col => col.notNull())
        .addColumn("banned_by_id", "text", col => col.notNull())
        .addColumn("feature", sql`available_features`, col => col.notNull())
        .addColumn("created_at", "timestamp", col => col.notNull().defaultTo(sql`timezone('utc', now())`))
        .addUniqueConstraint("banned_features_user_id_banned_by_feature_unique", ["user_id", "banned_by_id", "feature"])
        .execute();
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("banned_features").execute();
}
