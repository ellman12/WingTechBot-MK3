import { Kysely, sql } from "kysely";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
    await db.schema.createType("played_sound_source").asEnum(["Command", "Thread", "VoiceEvent"]).execute();

    await db.schema
        .createTable("played_sounds")
        .addColumn("id", "serial", col => col.notNull().primaryKey())
        .addColumn("user_id", "varchar(255)", col => col.notNull().references("users.id").onDelete("cascade"))
        .addColumn("sound_id", "integer", col => col.notNull().references("sounds.id").onDelete("cascade"))
        .addColumn("source", sql`played_sound_source`, col => col.notNull())
        .addColumn("played_at", "timestamptz", col => col.notNull().defaultTo(sql`now()`))
        .execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("played_sounds").execute();

    await db.schema.dropType("played_sound_source").execute();
}
