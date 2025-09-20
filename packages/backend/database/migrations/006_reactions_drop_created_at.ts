import { Kysely, sql } from "kysely";

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
    await db.schema.alterTable("reactions").dropColumn("created_at").execute();
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
    await db.schema
        .alterTable("reactions")
        .addColumn("created_at", "timestamp", col => col.notNull().defaultTo(sql`timezone('utc', now())`))
        .execute();
}
