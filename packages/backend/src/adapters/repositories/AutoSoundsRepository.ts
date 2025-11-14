import type { AutoSound } from "@core/entities/AutoSound";
import type { AutoSoundType, AutoSounds, DB } from "@db/types";
import type { Kysely, Selectable } from "kysely";
import type { AutoSoundsService } from "@core/services/AutoSoundsService";

export type AutoSoundsRepository = {
    readonly addAutoSound: (userId: string, soundId: number, type: AutoSoundType) => Promise<AutoSound>;
    readonly deleteAutoSound: (userId: string, soundId: number, type: AutoSoundType) => Promise<void>;
    readonly getAutoSoundsForUser: (userId: string, type: AutoSoundType) => Promise<AutoSound[]>;
};

//Stores sounds automatically played when certain events happen.
export const createAutoSoundsRepository = (db: Kysely<DB>): AutoSoundsRepository => {
    const transformAutoSound = (sound: Selectable<AutoSounds>): AutoSound => {
        return {
            userId: sound.user_id,
            soundId: sound.sound_id,
            type: sound.type,
        };
    };

    async function addAutoSound(userId: string, soundId: number, type: AutoSoundType): Promise<AutoSound> {
        if (userId === "" || soundId <= 0) {
            throw new Error("Invalid ID");
        }

        const [newAutoSound] = await db
            .insertInto("auto_sounds")
            .values({ user_id: userId, sound_id: soundId, type })
            .onConflict(oc => oc.doNothing())
            .returningAll()
            .execute();

        if (!newAutoSound) {
            throw new Error("Failed to add new AutoSound");
        }

        console.log("AutoSound added:", newAutoSound);

        return transformAutoSound(newAutoSound);
    }

    async function deleteAutoSound(userId: string, soundId: number, type: AutoSoundType): Promise<void> {
        const query = await db
            .deleteFrom("auto_sounds")
            .where("user_id", "=", userId)
            .where("sound_id", "=", soundId)
            .where("type", "=", type)
            .executeTakeFirst();

        if (!query || query.numDeletedRows === 0n) {
            throw new Error(`AutoSound with user_id, sound_id, type ${userId}, ${soundId}, ${type} not found`);
        }

        console.log(`AutoSound with user_id, sound_id, type ${userId}, ${soundId}, ${type} deleted successfully`);
    }

    async function getAutoSoundsForUser(userId: string, type: AutoSoundType): Promise<AutoSound[]> {
        const result = await db
            .selectFrom("auto_sounds")
            .innerJoin("sounds", "auto_sounds.sound_id", "sounds.id")
            .where("user_id", "=", userId)
            .where("type", "=", type)
            .select(["sound_id", "name", "user_id", "type"])
            .execute();

        return result.map(r => ({
            userId: r.user_id,
            soundId: r.sound_id,
            soundName: r.name,
            type: r.type,
        }));
    }

    return {
        addAutoSound,
        deleteAutoSound,
        getAutoSoundsForUser,
    };
};
