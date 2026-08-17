import { Kysely } from "kysely";

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .alterTable("voice_event_sounds")
        .alterColumn("user_id", col => col.setDataType("varchar(255)"))
        .execute();

    await db.schema.alterTable("voice_event_sounds").addForeignKeyConstraint("voice_event_sounds_user_id_fkey", ["user_id"], "users", ["id"]).onDelete("cascade").execute();
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.alterTable("voice_event_sounds").dropConstraint("voice_event_sounds_user_id_fkey").execute();

    await db.schema
        .alterTable("voice_event_sounds")
        .alterColumn("user_id", col => col.setDataType("text"))
        .execute();
}
