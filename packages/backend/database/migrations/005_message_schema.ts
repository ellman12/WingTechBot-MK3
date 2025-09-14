import { Kysely, sql } from "kysely";

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("messages")
        .addColumn("id", "text", col => col.primaryKey())
        .addColumn("author_id", "text", col => col.notNull())
        .addColumn("channel_id", "text", col => col.notNull())
        .addColumn("content", "text", col => col.notNull())
        .addColumn("referenced_message_id", "text", col => col.defaultTo(null)) //Intentionally skipping foreign key because if it tries to reference a message we haven't processed yet it'd error out.
        .addColumn("created_at", "timestamp", col => col.notNull().defaultTo(sql`timezone('utc', now())`))
        .addColumn("edited_at", "timestamp", col => col.defaultTo(null))
        .execute();

    await db.schema
        .alterTable("reactions")
        .addForeignKeyConstraint("reactions_message_id_fk", ["message_id"], "messages", ["id"], cb => cb.onDelete("cascade"))
        .execute();
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.alterTable("reactions").dropConstraint("reactions_message_id_fk").execute();

    await db.schema.dropTable("messages").execute();
}
