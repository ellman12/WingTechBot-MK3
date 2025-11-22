import { transformSoundTag } from "@adapters/repositories/SoundTagRepository.js";
import type { SoundRepository } from "@core/repositories/SoundRepository.js";
import { getItemsWithinDistance } from "@core/utils/searchUtils.js";
import type { DB, Sounds, Soundtags } from "@db/types.js";
import { type Kysely, type Selectable, sql } from "kysely";

import type { Sound } from "@/core/entities/Sound.js";

export const createSoundRepository = (db: Kysely<DB>): SoundRepository => {
    const transformSound = (sound: Selectable<Sounds>, soundtags?: Selectable<Soundtags>[]): Sound => {
        return {
            id: sound.id,
            name: sound.name,
            path: sound.path,
            soundtags: soundtags?.map(transformSoundTag) ?? [],
        };
    };

    async function addSound(audio: Omit<Sound, "id">): Promise<Sound> {
        const [newSound] = await db
            .insertInto("sounds")
            .values({
                name: audio.name,
                path: audio.path,
            })
            .onConflict(oc =>
                oc.column("name").doUpdateSet({
                    path: audio.path,
                })
            )
            .returningAll()
            .execute();

        if (!newSound) {
            throw new Error("Failed to add sound");
        }

        console.log("Sound added:", newSound.name);

        return transformSound(newSound);
    }

    async function getSoundByName(name: string): Promise<Sound | null> {
        const sound = await db.selectFrom("sounds").where("sounds.name", "=", name).selectAll().executeTakeFirst();

        return sound ? transformSound(sound) : null;
    }

    async function deleteSound(name: string): Promise<void> {
        const query = await db.deleteFrom("sounds").where("sounds.name", "=", name).executeTakeFirst();

        if (!query || query.numDeletedRows === 0n) {
            throw new Error(`Sound with name "${name}" not found`);
        }

        console.log(`Sound "${name}" deleted successfully`);
    }

    async function getAllSounds(): Promise<Sound[]> {
        const sounds = await db
            .selectFrom("sounds as s")
            .leftJoin("sound_soundtags as st", "s.id", "st.sound")
            .leftJoin("soundtags as t", "st.tag", "t.id")
            .select(["s.id", "s.name", "s.path", "s.created_at", sql<Selectable<Soundtags>[]>`COALESCE(JSON_AGG(t) FILTER (WHERE t.id IS NOT NULL), '[]')`.as("soundtags")])
            .groupBy(["s.id", "s.name"])
            .orderBy("s.name")
            .execute();

        return sounds.map(s => transformSound(s, s.soundtags));
    }

    async function getAllSoundsWithTagName(tagName: string): Promise<Sound[]> {
        const sounds = await db
            .selectFrom("sounds as s")
            .leftJoin("sound_soundtags as st", "s.id", "st.sound")
            .leftJoin("soundtags as t", "st.tag", "t.id")
            .select(["s.id", "s.name", "s.path", "s.created_at", sql<Selectable<Soundtags>[]>`COALESCE(JSON_AGG(t) FILTER (WHERE t.id IS NOT NULL), '[]')`.as("soundtags")])
            .where("t.name", "=", tagName)
            .groupBy(["s.id", "s.name"])
            .orderBy("s.name")
            .execute();

        return sounds.map(s => transformSound(s, s.soundtags));
    }

    async function tryGetSoundsWithinDistance(needle: string): Promise<(Sound & { distance: number })[]> {
        const availableSounds = await getAllSounds();
        const distances = getItemsWithinDistance(availableSounds, needle, t => t.name, 3);
        console.log(`[SoundRepository] Sounds within distance of 3 to "${needle}":`, distances);
        return distances;
    }

    return {
        addSound,
        getSoundByName,
        deleteSound,
        getAllSounds,
        getAllSoundsWithTagName,
        tryGetSoundsWithinDistance,
    };
};
