import { Kysely, sql } from "kysely";

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
    await db.schema.createType("auto_sound_type").asEnum(["UserJoin", "UserLeave"]).execute();

    await db.schema
        .createTable("auto_sounds")
        .addColumn("user_id", "text", col => col.notNull())
        .addColumn("sound_id", "integer", col => col.notNull().references("sounds.id").onDelete("cascade"))
        .addColumn("type", sql`auto_sound_type`, col => col.notNull())
        .addColumn("created_at", "timestamp", col => col.notNull().defaultTo(sql`timezone('utc', now())`))
        .addUniqueConstraint("auto_sounds_user_id_sound_id_unique", ["user_id", "sound_id", "type"])
        .execute();
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("auto_sounds").execute();
}
