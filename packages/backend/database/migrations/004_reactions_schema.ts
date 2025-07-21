import { Kysely, sql } from "kysely";

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("reactions")
        .addColumn("id", "serial", col => col.primaryKey())
        .addColumn("giver_id", "text", col => col.notNull())
        .addColumn("receiver_id", "text", col => col.notNull())
        .addColumn("channel_id", "text", col => col.notNull())
        .addColumn("message_id", "text", col => col.notNull())
        .addColumn("emote_id", "integer", col => col.notNull().references("reaction_emotes.id").onDelete("cascade"))
        .addColumn("created_at", "timestamp", col => col.notNull().defaultTo(sql`timezone('utc', now())`))
        .execute();
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("reactions").execute();
}
