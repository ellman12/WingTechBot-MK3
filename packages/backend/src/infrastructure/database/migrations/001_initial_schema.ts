import { Kysely, sql } from "kysely";

// Temporary database interface for this migration
interface Database {
    users: { id: string; username: string; display_name: string | null; avatar: string | null; is_bot: boolean; created_at: Date; updated_at: Date };
}

export async function up(db: Kysely<Database>): Promise<void> {
    // Create users table
    await db.schema
        .createTable("users")
        .addColumn("id", "varchar(255)", col => col.primaryKey())
        .addColumn("username", "varchar(255)", col => col.notNull())
        .addColumn("display_name", "varchar(255)")
        .addColumn("avatar", "text")
        .addColumn("is_bot", "boolean", col => col.notNull().defaultTo(false))
        .addColumn("created_at", "timestamp", col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .addColumn("updated_at", "timestamp", col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .execute();

    // Create indexes
    await db.schema.createIndex("idx_users_username").on("users").column("username").execute();

    await db.schema.createIndex("idx_users_created_at").on("users").column("created_at").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    // Drop indexes
    await db.schema.dropIndex("idx_users_created_at").execute();
    await db.schema.dropIndex("idx_users_username").execute();

    // Drop tables
    await db.schema.dropTable("users").execute();
}
