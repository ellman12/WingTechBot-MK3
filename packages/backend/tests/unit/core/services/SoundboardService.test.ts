import type { Config } from "@core/config/Config.js";
import type { Sound } from "@core/entities/Sound.js";
import type { BannedFeaturesRepository } from "@core/ports/repositories/BannedFeaturesRepository.js";
import type { SoundRepository } from "@core/ports/repositories/SoundRepository.js";
import type { VoiceService } from "@core/ports/services/VoiceService.js";
import { createSoundboardService } from "@core/services/SoundboardService.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTestConfig } from "../../../setup.js";

const defaultVoiceChannelId = "vc-1";
const serverId = "server-1";
const userId = "user-1";

const soundsWithin = (...sounds: { name: string; distance: number }[]): (Sound & { distance: number })[] => sounds.map(s => ({ name: s.name, path: `/${s.name}.pcm`, distance: s.distance }));

describe("SoundboardService", () => {
    let config: Config;
    let soundRepository: SoundRepository;
    let voiceService: VoiceService;
    let bannedFeaturesRepository: BannedFeaturesRepository;

    const createService = () => createSoundboardService({ config, soundRepository, voiceService, bannedFeaturesRepository });

    beforeEach(() => {
        const baseConfig = getTestConfig();
        config = { ...baseConfig, discord: { ...baseConfig.discord, defaultVoiceChannelId } };

        soundRepository = {
            addSound: vi.fn(),
            getSoundByName: vi.fn(),
            deleteSound: vi.fn(),
            getAllSounds: vi.fn(),
            getAllSoundsWithTagName: vi.fn(),
            tryGetSoundsWithinDistance: vi.fn().mockResolvedValue([]),
        };

        voiceService = {
            connect: vi.fn(),
            disconnect: vi.fn(),
            isConnected: vi.fn().mockReturnValue(true),
            getVoiceChannelId: vi.fn().mockReturnValue(defaultVoiceChannelId),
            playAudio: vi.fn(),
            stopAudio: vi.fn(),
            stopAudioById: vi.fn(),
            stopAllAudio: vi.fn(),
            isPlaying: vi.fn(),
            getActiveAudioCount: vi.fn(),
            getActiveAudioIds: vi.fn(),
            getVolume: vi.fn(),
            setVolume: vi.fn(),
            pause: vi.fn(),
            resume: vi.fn(),
        };

        bannedFeaturesRepository = {
            banFeature: vi.fn(),
            unbanFeature: vi.fn(),
            isUserBanned: vi.fn().mockResolvedValue(false),
            getBannedUsers: vi.fn(),
        };
    });

    it("returns banned without touching the soundboard", async () => {
        vi.mocked(bannedFeaturesRepository.isUserBanned).mockResolvedValue(true);

        const outcome = await createService().playSoundByText({ serverId, userId, text: "boom" });

        expect(outcome).toEqual({ kind: "banned" });
        expect(soundRepository.tryGetSoundsWithinDistance).not.toHaveBeenCalled();
        expect(voiceService.playAudio).not.toHaveBeenCalled();
    });

    it("returns noMatch when nothing is close enough", async () => {
        const outcome = await createService().playSoundByText({ serverId, userId, text: "nonsense" });

        expect(outcome).toEqual({ kind: "noMatch" });
        expect(voiceService.playAudio).not.toHaveBeenCalled();
    });

    it("searches with the lowercased text", async () => {
        await createService().resolveSound({ userId, text: "BooM" });

        expect(soundRepository.tryGetSoundsWithinDistance).toHaveBeenCalledWith("boom");
    });

    it("returns ambiguous when several near matches and no exact one", async () => {
        vi.mocked(soundRepository.tryGetSoundsWithinDistance).mockResolvedValue(soundsWithin({ name: "boom", distance: 1 }, { name: "boop", distance: 2 }));

        const outcome = await createService().playSoundByText({ serverId, userId, text: "boon" });

        expect(outcome).toEqual({ kind: "ambiguous", candidates: ["boom", "boop"] });
        expect(voiceService.playAudio).not.toHaveBeenCalled();
    });

    it("plays the exact match even when other sounds are near", async () => {
        vi.mocked(soundRepository.tryGetSoundsWithinDistance).mockResolvedValue(soundsWithin({ name: "boom", distance: 0 }, { name: "boop", distance: 1 }));

        const outcome = await createService().playSoundByText({ serverId, userId, text: "boom" });

        expect(outcome).toEqual({ kind: "played", soundName: "boom", corrected: false, originalText: "boom" });
        expect(voiceService.playAudio).toHaveBeenCalledWith(serverId, "boom", userId, "Thread");
    });

    it("corrects to the only near match", async () => {
        vi.mocked(soundRepository.tryGetSoundsWithinDistance).mockResolvedValue(soundsWithin({ name: "boom", distance: 1 }));

        const outcome = await createService().playSoundByText({ serverId, userId, text: "boon" });

        expect(outcome).toEqual({ kind: "played", soundName: "boom", corrected: true, originalText: "boon" });
        expect(voiceService.playAudio).toHaveBeenCalledWith(serverId, "boom", userId, "Thread");
    });

    it("connects to the default channel first when not connected", async () => {
        vi.mocked(voiceService.isConnected).mockReturnValue(false);
        vi.mocked(soundRepository.tryGetSoundsWithinDistance).mockResolvedValue(soundsWithin({ name: "boom", distance: 0 }));

        await createService().playSoundByText({ serverId, userId, text: "boom" });

        expect(voiceService.connect).toHaveBeenCalledWith(serverId, defaultVoiceChannelId);
    });

    it("does not reconnect when already connected", async () => {
        vi.mocked(soundRepository.tryGetSoundsWithinDistance).mockResolvedValue(soundsWithin({ name: "boom", distance: 0 }));

        await createService().playSoundByText({ serverId, userId, text: "boom" });

        expect(voiceService.connect).not.toHaveBeenCalled();
    });
});
