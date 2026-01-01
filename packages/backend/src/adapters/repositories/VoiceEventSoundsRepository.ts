import type { VoiceEventSound } from "@core/entities/VoiceEventSound.js";
import type { DB, VoiceEventSoundType, VoiceEventSounds } from "@db/types.js";
import type { Kysely, Selectable } from "kysely";

export type VoiceEventSoundsRepository = {
    readonly addVoiceEventSound: (userId: string, soundId: number, type: VoiceEventSoundType) => Promise<VoiceEventSound>;
    readonly deleteVoiceEventSound: (userId: string, soundId: number, type: VoiceEventSoundType) => Promise<VoiceEventSound | null>;
    readonly getVoiceEventSounds: (filters: GetVoiceEventSoundsFilters) => Promise<VoiceEventSound[]>;
};

export type GetVoiceEventSoundsFilters = {
    userId?: string;
    soundId?: number;
    type?: VoiceEventSoundType;
};

//Stores sounds automatically played when certain events happen.
export const createVoiceEventsSoundsRepository = (db: Kysely<DB>): VoiceEventSoundsRepository => {
    const transformVoiceEventSound = (sound: Selectable<VoiceEventSounds>): VoiceEventSound => {
        return {
            userId: sound.user_id,
            soundId: sound.sound_id,
            type: sound.type,
        };
    };

    async function addVoiceEventSound(userId: string, soundId: number, type: VoiceEventSoundType): Promise<VoiceEventSound> {
        if (userId === "" || soundId <= 0) {
            throw new Error("Invalid ID");
        }

        const existing = await db.selectFrom("voice_event_sounds").where("user_id", "=", userId).where("sound_id", "=", soundId).where("type", "=", type).selectAll().executeTakeFirst();
        if (existing) {
            return transformVoiceEventSound(existing);
        }

        const newVoiceEventSound = await db.insertInto("voice_event_sounds").values({ user_id: userId, sound_id: soundId, type }).returningAll().executeTakeFirst();
        if (!newVoiceEventSound) {
            throw new Error("Failed to add new VoiceEventSound");
        }

        console.log("VoiceEventSound added:", newVoiceEventSound);
        return transformVoiceEventSound(newVoiceEventSound);
    }

    async function deleteVoiceEventSound(userId: string, soundId: number, type: VoiceEventSoundType): Promise<VoiceEventSound | null> {
        const sound = await db.deleteFrom("voice_event_sounds").where("user_id", "=", userId).where("sound_id", "=", soundId).where("type", "=", type).returningAll().executeTakeFirst();

        if (!sound) {
            console.error(`VoiceEventSound with user_id, sound_id, type ${userId}, ${soundId}, ${type} not found`);
            return null;
        }

        console.log(`VoiceEventSound with user_id, sound_id, type ${userId}, ${soundId}, ${type} deleted successfully`);
        return transformVoiceEventSound(sound);
    }

    async function getVoiceEventSounds(filters: GetVoiceEventSoundsFilters): Promise<VoiceEventSound[]> {
        const { userId, soundId, type } = filters;

        const result = await db
            .selectFrom("voice_event_sounds as ves")
            .innerJoin("sounds", "ves.sound_id", "sounds.id")
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
        addVoiceEventSound,
        deleteVoiceEventSound,
        getVoiceEventSounds,
    };
};
