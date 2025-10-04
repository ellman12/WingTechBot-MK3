import type { SoundTag } from "@core/entities/SoundTag.js";
import type { SoundTagRepository } from "@core/repositories/SoundTagRepository.js";
import type { DB, Soundtags } from "@db/types.js";
import type { Kysely, Selectable } from "kysely";

export const transformSoundTag = (dbSoundTag: Selectable<Soundtags>): SoundTag => {
    return {
        id: dbSoundTag.id,
        name: dbSoundTag.name,
    };
};

export const createSoundTagRepository = (db: Kysely<DB>): SoundTagRepository => {
    async function createTag(name: string) {
        if (name.trim() === "") {
            throw new Error("Invalid sound tag name");
        }

        const result = await db
            .insertInto("soundtags")
            .values({ name })
            .onConflict(oc => oc.column("name").doNothing())
            .returningAll()
            .executeTakeFirstOrThrow();

        return transformSoundTag(result);
    }

    async function getTagByName(name: string): Promise<SoundTag | null> {
        const tag = await db.selectFrom("soundtags").where("name", "=", name).selectAll().executeTakeFirst();
        return tag ? transformSoundTag(tag) : null;
    }

    async function addTagToSound(soundId: number, tagId: number) {
        if (soundId <= 0 || tagId <= 0) {
            throw new Error("Invalid sound or tag id");
        }

        await db
            .insertInto("sound_soundtags")
            .values({ sound: soundId, tag: tagId })
            .onConflict(oc => oc.columns(["sound", "tag"]).doNothing())
            .execute();
    }

    async function removeTagFromSound(soundId: number, tagId: number) {
        if (soundId <= 0 || tagId <= 0) {
            throw new Error("Invalid sound or tag id");
        }

        await db.deleteFrom("sound_soundtags").where("sound", "=", soundId).where("tag", "=", tagId).executeTakeFirst();
    }

    async function getAllTags() {
        return await db.selectFrom("soundtags").selectAll().execute();
    }

    return {
        create: createTag,
        getTagByName,
        addTagToSound,
        removeTagFromSound,
        getAllTags,
    };
};
