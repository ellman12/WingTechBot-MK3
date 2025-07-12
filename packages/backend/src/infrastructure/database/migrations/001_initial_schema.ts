import { Kysely, sql } from "kysely";

// Temporary database interface for this migration
interface Database {
    users: { id: string; username: string; display_name: string | null; avatar: string | null; is_bot: boolean; created_at: Date; updated_at: Date };
    commands: { id: string; name: string; description: string | null; user_id: string; arguments: string | null; executed_at: Date; success: boolean; error: string | null };
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

    // Create commands table
    await db.schema
        .createTable("commands")
        .addColumn("id", "varchar(255)", col => col.primaryKey().defaultTo(sql`gen_random_uuid()::text`))
        .addColumn("name", "varchar(255)", col => col.notNull())
        .addColumn("description", "text")
        .addColumn("user_id", "varchar(255)", col => col.notNull())
        .addColumn("arguments", "text") // JSON serialized arguments
        .addColumn("executed_at", "timestamp", col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .addColumn("success", "boolean", col => col.notNull())
        .addColumn("error", "text")
        .execute();

    // Add foreign key constraint
    await db.schema
        .alterTable("commands")
        .addForeignKeyConstraint("commands_user_id_fkey", ["user_id"], "users", ["id"], cb => cb.onDelete("cascade"))
        .execute();

    // Create indexes
    await db.schema.createIndex("idx_users_username").on("users").column("username").execute();

    await db.schema.createIndex("idx_users_created_at").on("users").column("created_at").execute();

    await db.schema.createIndex("idx_commands_user_id").on("commands").column("user_id").execute();

    await db.schema.createIndex("idx_commands_executed_at").on("commands").column("executed_at").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    // Drop indexes
    await db.schema.dropIndex("idx_commands_executed_at").execute();
    await db.schema.dropIndex("idx_commands_user_id").execute();
    await db.schema.dropIndex("idx_users_created_at").execute();
    await db.schema.dropIndex("idx_users_username").execute();

    // Drop foreign key constraint
    await db.schema.alterTable("commands").dropConstraint("commands_user_id_fkey").execute();

    // Drop tables
    await db.schema.dropTable("commands").execute();
    await db.schema.dropTable("users").execute();
}
