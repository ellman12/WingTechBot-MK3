import { Kysely } from "kysely";

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
    await db.schema.createIndex("idx_reactions_columns").on("reactions").columns(["giver_id", "receiver_id", "channel_id", "message_id", "emote_id"]).execute();
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropIndex("idx_reactions_columns").execute();
}
