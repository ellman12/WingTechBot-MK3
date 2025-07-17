import type { SoundRepository } from "@core/repositories/SoundRepository";
import type { DB, Sounds } from "@db/types";
import type { Kysely, Selectable } from "kysely";

import type { Sound } from "@/core/entities/Sound";

export const createKyselySoundRepository = (db: Kysely<DB>): SoundRepository => {
    const transformSound = (sound: Selectable<Sounds>): Sound => {
        return {
            name: sound.name,
            path: sound.path,
        };
    };

    return {
        addSound: async (audio: Omit<Sound, "id">): Promise<Sound> => {
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
        },
        getSoundByName: async (name: string): Promise<Sound | null> => {
            const sound = await db.selectFrom("sounds").where("sounds.name", "=", name).selectAll().executeTakeFirst();

            return sound ? transformSound(sound) : null;
        },
        deleteSound: async (name: string): Promise<void> => {
            const query = await db.deleteFrom("sounds").where("sounds.name", "=", name).executeTakeFirst();

            if (!query || query.numDeletedRows === 0n) {
                throw new Error(`Sound with name "${name}" not found`);
            }

            console.log(`Sound "${name}" deleted successfully`);
        },
        getAllSounds: async (): Promise<Sound[]> => {
            const query = await db.selectFrom("sounds").selectAll().execute();

            return query.map(transformSound);
        },
    };
};
