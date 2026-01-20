import { Kysely, sql } from "kysely";

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
    //Convert timestamp columns in all tables to timestamptz, interpreting existing values as America/Chicago
    await sql`
    ALTER TABLE messages
      ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'America/Chicago',
      ALTER COLUMN edited_at TYPE timestamptz USING edited_at AT TIME ZONE 'America/Chicago';
    
    ALTER TABLE soundtags
      ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'America/Chicago';

    ALTER TABLE sounds
      ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'America/Chicago';

    ALTER TABLE sound_soundtags
      ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'America/Chicago';

    ALTER TABLE reaction_emotes
      ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'America/Chicago',
      ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'America/Chicago';

    ALTER TABLE voice_event_sounds
      ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'America/Chicago';

    ALTER TABLE banned_features
      ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'America/Chicago';
  `.execute(db);

    //Update defaults for future inserts to use UTC timestamptz
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

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
    //Revert timestamptz columns back to timestamp (local America/Chicago)
    await sql`
    ALTER TABLE messages
      ALTER COLUMN created_at TYPE timestamp USING created_at AT TIME ZONE 'America/Chicago',
      ALTER COLUMN edited_at TYPE timestamp USING edited_at AT TIME ZONE 'America/Chicago';
    
    ALTER TABLE soundtags
      ALTER COLUMN created_at TYPE timestamp USING created_at AT TIME ZONE 'America/Chicago';

    ALTER TABLE sounds
      ALTER COLUMN created_at TYPE timestamp USING created_at AT TIME ZONE 'America/Chicago';

    ALTER TABLE sound_soundtags
      ALTER COLUMN created_at TYPE timestamp USING created_at AT TIME ZONE 'America/Chicago';

    ALTER TABLE reaction_emotes
      ALTER COLUMN created_at TYPE timestamp USING created_at AT TIME ZONE 'America/Chicago',
      ALTER COLUMN updated_at TYPE timestamp USING updated_at AT TIME ZONE 'America/Chicago';

    ALTER TABLE voice_event_sounds
      ALTER COLUMN created_at TYPE timestamp USING created_at AT TIME ZONE 'America/Chicago';

    ALTER TABLE banned_features
      ALTER COLUMN created_at TYPE timestamp USING created_at AT TIME ZONE 'America/Chicago';
  `.execute(db);

    //Restore original defaults
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
