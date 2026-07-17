import type { CreatePlayedSoundData, PlayedSound } from "@core/entities/PlayedSounds.js";
import type { PlayedSoundsRepository, SoundPlayCount } from "@core/repositories/PlayedSoundsRepository.js";
import type { DB, PlayedSounds } from "@db/types.js";
import type { Kysely, Selectable } from "kysely";
import { sql } from "kysely";

const transformPlayedSound = (dbSoundPlay: Selectable<PlayedSounds>): PlayedSound => {
    return {
        id: dbSoundPlay.id,
        userId: dbSoundPlay.user_id,
        soundId: dbSoundPlay.sound_id,
        source: dbSoundPlay.source,
        playedAt: dbSoundPlay.played_at,
    };
};

export const createPlayedSoundsRepository = (db: Kysely<DB>): PlayedSoundsRepository => {
    const addPlayedSound = async (data: CreatePlayedSoundData): Promise<PlayedSound> => {
        const { userId, soundId, source } = data;
        const ids = [userId, soundId];
        if (ids.some(i => !i || i === "0")) {
            throw new Error("Invalid id");
        }

        const values = { user_id: userId, sound_id: soundId, source };
        const playedSound = await db.insertInto("played_sounds").values(values).returningAll().executeTakeFirst();
        if (!playedSound) throw new Error("Failed to create playedSound");

        return transformPlayedSound(playedSound);
    };

    const getSoundPlayCount = async (soundId: number, userId?: string, year?: number): Promise<number> => {
        const result = await db
            .selectFrom("played_sounds")
            .select(db.fn.countAll().as("count"))
            .where("sound_id", "=", soundId)
            .$if(userId !== undefined, qb => qb.where("played_sounds.user_id", "=", userId!))
            .$if(year !== undefined, qb => qb.where(sql`extract(year from ${sql.ref("played_sounds.played_at")})`, "=", year))
            .executeTakeFirst();

        return Number(result?.count ?? 0);
    };

    const getSoundPlayCounts = async (limit = 15, userId?: string, year?: number): Promise<SoundPlayCount[]> => {
        const rows = await db
            .selectFrom("played_sounds")
            .innerJoin("sounds", "sounds.id", "played_sounds.sound_id")
            .select(["sound_id", "name", db.fn.countAll().as("play_count")])
            .$if(userId !== undefined, qb => qb.where("played_sounds.user_id", "=", userId!))
            .$if(year !== undefined, qb => qb.where(sql`extract(year from ${sql.ref("played_sounds.played_at")})`, "=", year))
            .groupBy(["sound_id", "name"])
            .orderBy("play_count", "desc")
            .limit(limit)
            .execute();

        return rows.map(r => ({ id: r.sound_id, name: r.name, playCount: Number(r.play_count) }));
    };

    return {
        addPlayedSound,
        getSoundPlayCount,
        getSoundPlayCounts,
    };
};
