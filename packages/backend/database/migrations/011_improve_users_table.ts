import { type Kysely, sql } from "kysely";

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .alterTable("users")
        .dropColumn("display_name")
        .dropColumn("avatar")
        .dropColumn("created_at")
        .dropColumn("updated_at")
        .addColumn("created_at", "timestamptz", col => col.notNull())
        .addColumn("joined_at", "timestamptz", col => col.defaultTo(null)) //When they joined this server, from the Discord API. Null if left the server.
        .execute();
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
    await db.schema
        .alterTable("users")
        .addColumn("display_name", "varchar(255)")
        .addColumn("avatar", "text")
        .dropColumn("created_at")
        .addColumn("created_at", "timestamp", col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .addColumn("updated_at", "timestamp", col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .dropColumn("joined_at")
        .execute();
}
