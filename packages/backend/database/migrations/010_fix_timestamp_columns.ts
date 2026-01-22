import { Kysely, sql } from "kysely";

//Fixes all the timestamp columns being in CST, converting them to UTC.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
    // messages
    await sql`
    ALTER TABLE messages ADD COLUMN created_at_tmp timestamptz NOT NULL;
    ALTER TABLE messages ADD COLUMN edited_at_tmp timestamptz;

    UPDATE messages SET created_at_tmp = timezone('America/Chicago', created_at);
    UPDATE messages SET edited_at_tmp  = timezone('America/Chicago', edited_at);

    ALTER TABLE messages DROP COLUMN created_at;
    ALTER TABLE messages DROP COLUMN edited_at;

    ALTER TABLE messages RENAME COLUMN created_at_tmp TO created_at;
    ALTER TABLE messages RENAME COLUMN edited_at_tmp  TO edited_at;
  `.execute(db);

    // soundtags
    await sql`
    ALTER TABLE soundtags ADD COLUMN created_at_tmp timestamptz NOT NULL;

    UPDATE soundtags SET created_at_tmp = timezone('America/Chicago', created_at);

    ALTER TABLE soundtags DROP COLUMN created_at;
    ALTER TABLE soundtags RENAME COLUMN created_at_tmp TO created_at;
  `.execute(db);

    // sounds
    await sql`
    ALTER TABLE sounds ADD COLUMN created_at_tmp timestamptz NOT NULL;

    UPDATE sounds SET created_at_tmp = timezone('America/Chicago', created_at);

    ALTER TABLE sounds DROP COLUMN created_at;
    ALTER TABLE sounds RENAME COLUMN created_at_tmp TO created_at;
  `.execute(db);

    // sound_soundtags
    await sql`
    ALTER TABLE sound_soundtags ADD COLUMN created_at_tmp timestamptz NOT NULL;

    UPDATE sound_soundtags SET created_at_tmp = timezone('America/Chicago', created_at);

    ALTER TABLE sound_soundtags DROP COLUMN created_at;
    ALTER TABLE sound_soundtags RENAME COLUMN created_at_tmp TO created_at;
  `.execute(db);

    // reaction_emotes
    await sql`
    ALTER TABLE reaction_emotes ADD COLUMN created_at_tmp timestamptz NOT NULL;
    ALTER TABLE reaction_emotes ADD COLUMN updated_at_tmp timestamptz NOT NULL;

    UPDATE reaction_emotes SET created_at_tmp = timezone('America/Chicago', created_at);
    UPDATE reaction_emotes SET updated_at_tmp = timezone('America/Chicago', updated_at);

    ALTER TABLE reaction_emotes DROP COLUMN created_at;
    ALTER TABLE reaction_emotes DROP COLUMN updated_at;

    ALTER TABLE reaction_emotes RENAME COLUMN created_at_tmp TO created_at;
    ALTER TABLE reaction_emotes RENAME COLUMN updated_at_tmp TO updated_at;
  `.execute(db);

    // voice_event_sounds
    await sql`
    ALTER TABLE voice_event_sounds ADD COLUMN created_at_tmp timestamptz NOT NULL;

    UPDATE voice_event_sounds SET created_at_tmp = timezone('America/Chicago', created_at);

    ALTER TABLE voice_event_sounds DROP COLUMN created_at;
    ALTER TABLE voice_event_sounds RENAME COLUMN created_at_tmp TO created_at;
  `.execute(db);

    // banned_features
    await sql`
    ALTER TABLE banned_features ADD COLUMN created_at_tmp timestamptz NOT NULL;

    UPDATE banned_features SET created_at_tmp = timezone('America/Chicago', created_at);

    ALTER TABLE banned_features DROP COLUMN created_at;
    ALTER TABLE banned_features RENAME COLUMN created_at_tmp TO created_at;
  `.execute(db);

    // defaults (UTC timestamptz)
    await sql`
    ALTER TABLE messages ALTER COLUMN created_at SET DEFAULT now();
    ALTER TABLE soundtags ALTER COLUMN created_at SET DEFAULT now();
    ALTER TABLE sounds ALTER COLUMN created_at SET DEFAULT now();
    ALTER TABLE sound_soundtags ALTER COLUMN created_at SET DEFAULT now();
    ALTER TABLE reaction_emotes ALTER COLUMN created_at SET DEFAULT now();
    ALTER TABLE reaction_emotes ALTER COLUMN updated_at SET DEFAULT now();
    ALTER TABLE voice_event_sounds ALTER COLUMN created_at SET DEFAULT now();
    ALTER TABLE banned_features ALTER COLUMN created_at SET DEFAULT now();
  `.execute(db);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
    // messages
    await sql`
    ALTER TABLE messages ADD COLUMN created_at_tmp timestamp NOT NULL;
    ALTER TABLE messages ADD COLUMN edited_at_tmp timestamp;

    UPDATE messages SET created_at_tmp = timezone('America/Chicago', created_at);
    UPDATE messages SET edited_at_tmp  = timezone('America/Chicago', edited_at);

    ALTER TABLE messages DROP COLUMN created_at;
    ALTER TABLE messages DROP COLUMN edited_at;

    ALTER TABLE messages RENAME COLUMN created_at_tmp TO created_at;
    ALTER TABLE messages RENAME COLUMN edited_at_tmp  TO edited_at;
  `.execute(db);

    // soundtags
    await sql`
    ALTER TABLE soundtags ADD COLUMN created_at_tmp timestamp NOT NULL;

    UPDATE soundtags SET created_at_tmp = timezone('America/Chicago', created_at);

    ALTER TABLE soundtags DROP COLUMN created_at;
    ALTER TABLE soundtags RENAME COLUMN created_at_tmp TO created_at;
  `.execute(db);

    // sounds
    await sql`
    ALTER TABLE sounds ADD COLUMN created_at_tmp timestamp NOT NULL;

    UPDATE sounds SET created_at_tmp = timezone('America/Chicago', created_at);

    ALTER TABLE sounds DROP COLUMN created_at;
    ALTER TABLE sounds RENAME COLUMN created_at_tmp TO created_at;
  `.execute(db);

    // sound_soundtags
    await sql`
    ALTER TABLE sound_soundtags ADD COLUMN created_at_tmp timestamp NOT NULL;

    UPDATE sound_soundtags SET created_at_tmp = timezone('America/Chicago', created_at);

    ALTER TABLE sound_soundtags DROP COLUMN created_at;
    ALTER TABLE sound_soundtags RENAME COLUMN created_at_tmp TO created_at;
  `.execute(db);

    // reaction_emotes
    await sql`
    ALTER TABLE reaction_emotes ADD COLUMN created_at_tmp timestamp NOT NULL;
    ALTER TABLE reaction_emotes ADD COLUMN updated_at_tmp timestamp NOT NULL;

    UPDATE reaction_emotes SET created_at_tmp = timezone('America/Chicago', created_at);
    UPDATE reaction_emotes SET updated_at_tmp = timezone('America/Chicago', updated_at);

    ALTER TABLE reaction_emotes DROP COLUMN created_at;
    ALTER TABLE reaction_emotes DROP COLUMN updated_at;

    ALTER TABLE reaction_emotes RENAME COLUMN created_at_tmp TO created_at;
    ALTER TABLE reaction_emotes RENAME COLUMN updated_at_tmp TO updated_at;
  `.execute(db);

    // voice_event_sounds
    await sql`
    ALTER TABLE voice_event_sounds ADD COLUMN created_at_tmp timestamp NOT NULL;

    UPDATE voice_event_sounds SET created_at_tmp = timezone('America/Chicago', created_at);

    ALTER TABLE voice_event_sounds DROP COLUMN created_at;
    ALTER TABLE voice_event_sounds RENAME COLUMN created_at_tmp TO created_at;
  `.execute(db);

    // banned_features
    await sql`
    ALTER TABLE banned_features ADD COLUMN created_at_tmp timestamp NOT NULL;

    UPDATE banned_features SET created_at_tmp = timezone('America/Chicago', created_at);

    ALTER TABLE banned_features DROP COLUMN created_at;
    ALTER TABLE banned_features RENAME COLUMN created_at_tmp TO created_at;
  `.execute(db);

    // restore original defaults
    await sql`
    ALTER TABLE messages ALTER COLUMN created_at SET DEFAULT timezone('utc', now());
    ALTER TABLE soundtags ALTER COLUMN created_at SET DEFAULT timezone('utc', now());
    ALTER TABLE sounds ALTER COLUMN created_at SET DEFAULT timezone('utc', now());
    ALTER TABLE sound_soundtags ALTER COLUMN created_at SET DEFAULT timezone('utc', now());
    ALTER TABLE reaction_emotes ALTER COLUMN created_at SET DEFAULT timezone('utc', now());
    ALTER TABLE reaction_emotes ALTER COLUMN updated_at SET DEFAULT timezone('utc', now());
    ALTER TABLE voice_event_sounds ALTER COLUMN created_at SET DEFAULT timezone('utc', now());
    ALTER TABLE banned_features ALTER COLUMN created_at SET DEFAULT timezone('utc', now());
  `.execute(db);
}
