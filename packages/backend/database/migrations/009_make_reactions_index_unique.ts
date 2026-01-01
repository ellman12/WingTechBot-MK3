import { Kysely, sql } from "kysely";

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
    // Drop the existing non-unique index
    await db.schema.dropIndex("idx_reactions_columns").execute();

    // Remove duplicate reactions before creating the unique index
    // This is necessary in case there are existing duplicates that would cause the unique index creation to fail
    // Uses a CTE approach that works with both PostgreSQL and pg-mem
    await sql`
        DELETE FROM reactions
        WHERE (giver_id, receiver_id, channel_id, message_id, emote_id) IN (
            SELECT giver_id, receiver_id, channel_id, message_id, emote_id
            FROM (
                SELECT
                    giver_id,
                    receiver_id,
                    channel_id,
                    message_id,
                    emote_id,
                    ROW_NUMBER() OVER (
                        PARTITION BY giver_id, receiver_id, channel_id, message_id, emote_id
                        ORDER BY giver_id
                    ) as rn
                FROM reactions
            ) duplicates
            WHERE rn > 1
        )
    `.execute(db);

    // Create a unique index to prevent duplicate reactions
    await db.schema.createIndex("idx_reactions_columns").on("reactions").columns(["giver_id", "receiver_id", "channel_id", "message_id", "emote_id"]).unique().execute();
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
    // Drop the unique index
    await db.schema.dropIndex("idx_reactions_columns").execute();

    // Recreate the non-unique index
    await db.schema.createIndex("idx_reactions_columns").on("reactions").columns(["giver_id", "receiver_id", "channel_id", "message_id", "emote_id"]).execute();
}
