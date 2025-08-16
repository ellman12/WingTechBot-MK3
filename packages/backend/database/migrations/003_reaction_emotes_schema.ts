import { Kysely, sql } from "kysely";

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("reaction_emotes")
        .addColumn("id", "serial", col => col.primaryKey())
        .addColumn("name", "text", col => col.notNull())
        .addColumn("discord_id", "text")
        .addColumn("karma_value", "integer", col => col.notNull().defaultTo(0))
        .addColumn("created_at", "timestamp", col => col.notNull().defaultTo(sql`timezone('utc', now())`))
        .addColumn("updated_at", "timestamp", col => col.notNull().defaultTo(sql`timezone('utc', now())`))
        .execute();

    await db.schema.createIndex("reaction_emotes_name_discord_id_idx").on("reaction_emotes").columns(["name", "discord_id"]).execute();
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("reaction_emotes").execute();
}
