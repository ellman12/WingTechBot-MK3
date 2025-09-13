import { Kysely, sql } from "kysely";

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("messages")
        .addColumn("id", "text", col => col.primaryKey())
        .addColumn("author_id", "text", col => col.notNull())
        .addColumn("channel_id", "text", col => col.notNull())
        .addColumn("message_id", "text", col => col.notNull())
        .addColumn("content", "text", col => col.notNull())
        .addColumn("created_at", "timestamp", col => col.notNull().defaultTo(sql`timezone('utc', now())`))
        .addColumn("edited_at", "timestamp")
        .execute();
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("messages").execute();
}
