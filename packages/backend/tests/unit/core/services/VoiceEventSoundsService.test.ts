import type { Config } from "@core/config/Config.js";
import type { VoiceEventSound } from "@core/entities/VoiceEventSound.js";
import type { VoiceEventSoundsRepository } from "@core/ports/repositories/VoiceEventSoundsRepository.js";
import type { VoiceService } from "@core/ports/services/VoiceService.js";
import { type VoiceEvent, createVoiceEventSoundsService, getEventType } from "@core/services/VoiceEventSoundsService.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getTestConfig } from "../../../setup.js";

const defaultVoiceChannelId = "vc-1";
const serverId = "server-1";
const userId = "user-1";
const botId = "bot-1";

const sound = (soundName: string): VoiceEventSound & { username: string } => ({ userId, soundId: 1, soundName, type: "UserJoin", username: "someone" });

describe("getEventType", () => {
    it("is UserJoin when arriving from nowhere", () => {
        expect(getEventType(null, "vc-1")).toBe("UserJoin");
    });

    it("is UserLeave when leaving to nowhere", () => {
        expect(getEventType("vc-1", null)).toBe("UserLeave");
    });

    it("is nothing when switching channels", () => {
        expect(getEventType("vc-1", "vc-2")).toBeNull();
    });

    it("is nothing when staying put (e.g. mute/deafen)", () => {
        expect(getEventType("vc-1", "vc-1")).toBeNull();
        expect(getEventType(null, null)).toBeNull();
    });
});

describe("VoiceEventSoundsService", () => {
    let config: Config;
    let voiceEventSoundsRepository: VoiceEventSoundsRepository;
    let voiceService: VoiceService;
    let getChannelMemberIds: VoiceEvent["getChannelMemberIds"];

    const createService = () => createVoiceEventSoundsService({ config, voiceEventSoundsRepository, voiceService });

    //The service sleeps before playing, so drive the clock forward while the handler is in flight.
    const handle = async (event: Partial<VoiceEvent> = {}): Promise<void> => {
        const promise = createService().handleVoiceEvent({ serverId, userId, type: "UserJoin", userChannelId: defaultVoiceChannelId, getChannelMemberIds, ...event });
        await vi.runAllTimersAsync();
        await promise;
    };

    beforeEach(() => {
        vi.useFakeTimers();

        const baseConfig = getTestConfig();
        config = { ...baseConfig, discord: { ...baseConfig.discord, defaultVoiceChannelId, clientId: botId } };

        voiceEventSoundsRepository = {
            addVoiceEventSound: vi.fn(),
            deleteVoiceEventSound: vi.fn(),
            getVoiceEventSounds: vi.fn().mockResolvedValue([]),
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

        getChannelMemberIds = vi.fn().mockResolvedValue([botId, userId]);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("ignores events in a channel the bot is not in", async () => {
        await handle({ userChannelId: "vc-somewhere-else" });

        expect(voiceEventSoundsRepository.getVoiceEventSounds).not.toHaveBeenCalled();
        expect(voiceService.playAudio).not.toHaveBeenCalled();
    });

    it("falls back to the default channel when the bot is not connected", async () => {
        vi.mocked(voiceService.getVoiceChannelId).mockReturnValue(null);
        vi.mocked(voiceEventSoundsRepository.getVoiceEventSounds).mockResolvedValue([sound("hello")]);

        await handle();

        expect(getChannelMemberIds).toHaveBeenCalledWith(defaultVoiceChannelId);
        expect(voiceService.playAudio).toHaveBeenCalledWith(serverId, "hello", botId, "VoiceEvent");
    });

    it("never connects on its own", async () => {
        vi.mocked(voiceService.isConnected).mockReturnValue(false);
        vi.mocked(voiceEventSoundsRepository.getVoiceEventSounds).mockResolvedValue([sound("hello")]);

        await handle();

        expect(voiceService.connect).not.toHaveBeenCalled();
    });

    it("does nothing when the user has no sound for the event", async () => {
        await handle();

        expect(voiceEventSoundsRepository.getVoiceEventSounds).toHaveBeenCalledWith({ userId, type: "UserJoin" });
        expect(voiceService.playAudio).not.toHaveBeenCalled();
    });

    it("stays quiet on UserLeave when only the bot is left", async () => {
        vi.mocked(getChannelMemberIds).mockResolvedValue([botId]);
        vi.mocked(voiceEventSoundsRepository.getVoiceEventSounds).mockResolvedValue([sound("goodbye")]);

        await handle({ type: "UserLeave" });

        expect(voiceEventSoundsRepository.getVoiceEventSounds).not.toHaveBeenCalled();
        expect(voiceService.playAudio).not.toHaveBeenCalled();
    });

    it("still plays on UserJoin when the bot is alone", async () => {
        vi.mocked(getChannelMemberIds).mockResolvedValue([botId]);
        vi.mocked(voiceEventSoundsRepository.getVoiceEventSounds).mockResolvedValue([sound("hello")]);

        await handle();

        expect(voiceService.playAudio).toHaveBeenCalledWith(serverId, "hello", botId, "VoiceEvent");
    });

    it("picks one of the user's sounds when several are assigned", async () => {
        vi.mocked(voiceEventSoundsRepository.getVoiceEventSounds).mockResolvedValue([sound("a"), sound("b")]);

        await handle();

        expect(voiceService.playAudio).toHaveBeenCalledTimes(1);
        expect(["a", "b"]).toContain(vi.mocked(voiceService.playAudio).mock.calls[0]![1]);
    });

    it("waits 1200ms before a UserJoin sound", async () => {
        vi.mocked(voiceEventSoundsRepository.getVoiceEventSounds).mockResolvedValue([sound("hello")]);

        const promise = createService().handleVoiceEvent({ serverId, userId, type: "UserJoin", userChannelId: defaultVoiceChannelId, getChannelMemberIds });

        await vi.advanceTimersByTimeAsync(1199);
        expect(voiceService.playAudio).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        await promise;
        expect(voiceService.playAudio).toHaveBeenCalledOnce();
    });

    it("waits 55ms before a UserLeave sound", async () => {
        vi.mocked(voiceEventSoundsRepository.getVoiceEventSounds).mockResolvedValue([sound("goodbye")]);

        const promise = createService().handleVoiceEvent({ serverId, userId, type: "UserLeave", userChannelId: defaultVoiceChannelId, getChannelMemberIds });

        await vi.advanceTimersByTimeAsync(54);
        expect(voiceService.playAudio).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        await promise;
        expect(voiceService.playAudio).toHaveBeenCalledOnce();
    });
});
