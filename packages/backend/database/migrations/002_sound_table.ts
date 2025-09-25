import { Kysely, sql } from "kysely";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("soundtags")
        .addColumn("id", "serial", col => col.notNull().primaryKey())
        .addColumn("name", "text", col => col.notNull().unique())
        .addColumn("created_at", "timestamp", col => col.notNull().defaultTo(sql`timezone('utc', now())`))
        .execute();

    await db.schema
        .createTable("sounds")
        .addColumn("id", "serial", col => col.notNull().primaryKey())
        .addColumn("name", "text", col => col.notNull().unique())
        .addColumn("path", "text", col => col.notNull().unique())
        .addColumn("created_at", "timestamp", col => col.notNull().defaultTo(sql`timezone('utc', now())`))
        .execute();

    await db.schema
        .createTable("sound_soundtags")
        .addColumn("id", "serial", col => col.notNull().primaryKey())
        .addColumn("sound", "serial", col => col.notNull().references("sounds.id").onDelete("cascade"))
        .addColumn("tag", "serial", col => col.notNull().references("soundtags.id").onDelete("cascade"))
        .addColumn("created_at", "timestamp", col => col.notNull().defaultTo(sql`timezone('utc', now())`))
        .addForeignKeyConstraint("fk_sound_soundtags_sound", ["sound"], "sounds", ["id"])
        .addForeignKeyConstraint("fk_sound_soundtags_tag", ["tag"], "soundtags", ["id"])
        .execute();

    await db.schema.createIndex("idx_sounds_name").on("sounds").column("name").execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("sound_soundtags").execute();
    await db.schema.dropTable("sounds").execute();
    await db.schema.dropTable("soundtags").execute();
}
