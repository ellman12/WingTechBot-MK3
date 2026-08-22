import type { Sound } from "@core/entities/Sound.js";
import type { SoundTag } from "@core/entities/SoundTag.js";
import type { SoundRepository } from "@core/ports/repositories/SoundRepository.js";
import type { SoundTagRepository } from "@core/ports/repositories/SoundTagRepository.js";
import { createCommandChoicesService } from "@core/services/CommandChoicesService.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sound = (name: string): Sound => ({ name, path: `/${name}.pcm` });
const tag = (id: number, name: string): SoundTag => ({ id, name });

describe("CommandChoicesService", () => {
    let soundRepository: SoundRepository;
    let soundTagRepository: SoundTagRepository;

    const createService = () => createCommandChoicesService({ soundRepository, soundTagRepository });

    beforeEach(() => {
        soundRepository = {
            addSound: vi.fn(),
            getSoundByName: vi.fn(),
            deleteSound: vi.fn(),
            getAllSounds: vi.fn().mockResolvedValue([sound("boom"), sound("clap")]),
            getAllSoundsWithTagName: vi.fn(),
            tryGetSoundsWithinDistance: vi.fn().mockResolvedValue([{ ...sound("boom"), distance: 1 }]),
        };

        soundTagRepository = {
            create: vi.fn(),
            getTagByName: vi.fn(),
            addTagToSound: vi.fn(),
            removeTagFromSound: vi.fn(),
            getAllTags: vi.fn().mockResolvedValue([tag(1, "funny"), tag(2, "loud")]),
            tryGetTagsWithinDistance: vi.fn().mockResolvedValue([{ ...tag(1, "funny"), distance: 1 }]),
        };
    });

    it("returns nothing for an unknown field", async () => {
        expect(await createService().getAutocompleteChoices("who-knows", "")).toEqual([]);
    });

    it("lists every sound for an empty sound-name", async () => {
        expect(await createService().getAutocompleteChoices("sound-name", "")).toEqual([
            { name: "boom", value: "boom" },
            { name: "clap", value: "clap" },
        ]);
    });

    it("searches by distance for a non-empty sound-name", async () => {
        expect(await createService().getAutocompleteChoices("sound-name", "boon")).toEqual([{ name: "boom", value: "boom" }]);
        expect(soundRepository.tryGetSoundsWithinDistance).toHaveBeenCalledWith("boon");
    });

    it("lists every tag for an empty tag-name", async () => {
        expect(await createService().getAutocompleteChoices("tag-name", "")).toEqual([
            { name: "funny", value: "funny" },
            { name: "loud", value: "loud" },
        ]);
    });

    it("offers random alongside sounds for an empty audio-source", async () => {
        expect(await createService().getAutocompleteChoices("audio-source", "")).toEqual([
            { name: "random", value: "random" },
            { name: "boom", value: "boom" },
            { name: "clap", value: "clap" },
        ]);
    });

    it("keeps offering random while the input still looks like it", async () => {
        expect(await createService().getAutocompleteChoices("audio-source", "ra")).toEqual([
            { name: "random", value: "random" },
            { name: "boom", value: "boom" },
        ]);
    });

    it("prefixes audio-source tag suggestions with #", async () => {
        expect(await createService().getAutocompleteChoices("audio-source", "#fun")).toEqual([{ name: "#funny", value: "#funny" }]);
        expect(soundTagRepository.tryGetTagsWithinDistance).toHaveBeenCalledWith("fun");
    });

    it("lists every tag for a bare # audio-source", async () => {
        expect(await createService().getAutocompleteChoices("audio-source", "#")).toEqual([
            { name: "#funny", value: "#funny" },
            { name: "#loud", value: "#loud" },
        ]);
    });

    it("does a plain sound search for any other audio-source", async () => {
        expect(await createService().getAutocompleteChoices("audio-source", "boon")).toEqual([{ name: "boom", value: "boom" }]);
        expect(soundTagRepository.tryGetTagsWithinDistance).not.toHaveBeenCalled();
    });
});
