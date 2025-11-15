import type { AutoSound } from "@core/entities/AutoSound.js";
import type { AutoSoundType, AutoSounds, DB } from "@db/types";
import type { Kysely, Selectable } from "kysely";

export type AutoSoundsRepository = {
    readonly addAutoSound: (userId: string, soundId: number, type: AutoSoundType) => Promise<AutoSound>;
    readonly deleteAutoSound: (userId: string, soundId: number, type: AutoSoundType) => Promise<AutoSound | null>;
    readonly getAutoSounds: (filters: GetAutoSoundsFilters) => Promise<AutoSound[]>;
};

export type GetAutoSoundsFilters = {
    userId?: string;
    soundId?: number;
    type?: AutoSoundType;
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

        const existing = await db.selectFrom("auto_sounds").where("user_id", "=", userId).where("sound_id", "=", soundId).where("type", "=", type).selectAll().executeTakeFirst();
        if (existing) {
            return transformAutoSound(existing);
        }

        const newAutoSound = await db.insertInto("auto_sounds").values({ user_id: userId, sound_id: soundId, type }).returningAll().executeTakeFirst();
        if (!newAutoSound) {
            throw new Error("Failed to add new AutoSound");
        }

        console.log("AutoSound added:", newAutoSound);
        return transformAutoSound(newAutoSound);
    }

    async function deleteAutoSound(userId: string, soundId: number, type: AutoSoundType): Promise<AutoSound | null> {
        const sound = await db.deleteFrom("auto_sounds").where("user_id", "=", userId).where("sound_id", "=", soundId).where("type", "=", type).returningAll().executeTakeFirst();

        if (!sound) {
            console.error(`AutoSound with user_id, sound_id, type ${userId}, ${soundId}, ${type} not found`);
            return null;
        }

        console.log(`AutoSound with user_id, sound_id, type ${userId}, ${soundId}, ${type} deleted successfully`);
        return transformAutoSound(sound);
    }

    async function getAutoSounds(filters: GetAutoSoundsFilters): Promise<AutoSound[]> {
        const { userId, soundId, type } = filters;

        const result = await db
            .selectFrom("auto_sounds")
            .innerJoin("sounds", "auto_sounds.sound_id", "sounds.id")
            .$if(userId !== undefined, qb => qb.where("user_id", "=", userId!))
            .$if(soundId !== undefined, qb => qb.where("sound_id", "=", soundId!))
            .$if(type !== undefined, qb => qb.where("type", "=", type!))
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
        getAutoSounds,
    };
};
