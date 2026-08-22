import { createAudioCommands } from "@application/commands/AudioCommands.js";
import type { DiscordChatService } from "@application/discord/DiscordChat.js";
import { MAX_SOUND_NAME_LENGTH, validateSoundName } from "@core/entities/Sound.js";
import type { CommandChoicesService } from "@core/services/CommandChoicesService.js";
import type { SoundService } from "@core/services/SoundService.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSoundService: SoundService = {
    addSound: vi.fn(),
    getSound: vi.fn(),
    getRepeatedSound: vi.fn(),
    listSounds: vi.fn(),
    deleteSound: vi.fn(),
};

const mockDiscordChatService = {
    replyToInteraction: vi.fn(),
} as unknown as DiscordChatService;

const mockCommandChoicesService: CommandChoicesService = {
    getAutocompleteChoices: vi.fn(),
};

// Minimal stand-in for the slash command interaction used by /add-sound
const createAddSoundInteraction = (name: string | null, url: string | null) => {
    const editReply = vi.fn();
    const reply = vi.fn();
    const deferReply = vi.fn();

    const interaction = {
        guildId: "guild-1",
        options: {
            getString: (option: string) => (option === "name" ? name : option === "url" ? url : null),
            getAttachment: () => null,
        },
        deferReply,
        editReply,
        reply,
    } as unknown as ChatInputCommandInteraction;

    return { interaction, editReply, reply, deferReply };
};

describe("AudioCommands", () => {
    describe("validateSoundName", () => {
        it.each(["hello", "hello-world", "hello_world", "sound123", "123", "a"])("should accept valid name %s", name => {
            expect(validateSoundName(name)).toBeUndefined();
        });

        it("should keep rejecting the reserved name random with the same message", () => {
            expect(validateSoundName("random")).toBe(`Cannot use reserved name "random" for a sound.`);
        });

        it("should keep rejecting the reserved name currently-playing with the same message", () => {
            expect(validateSoundName("currently-playing")).toBe(`Cannot use reserved name "currently-playing" for a sound.`);
        });

        it("should keep rejecting names starting with # with the same message", () => {
            expect(validateSoundName("#tag")).toBe(`Cannot use names starting with "#" (reserved for tags).`);
        });

        it("should keep rejecting names containing commas with the same message", () => {
            expect(validateSoundName("one,two")).toBe(`Cannot use commas in sound names (reserved for multi-sound selection).`);
        });

        it.each([
            "../evil",
            "../../../etc/passwd",
            "..",
            "..\\..\\windows\\system32",
            "sub/dir",
            "/absolute/path",
            "\\absolute\\path",
            "sound/../../escape",
            "..%2f..%2fetc%2fpasswd",
            "%2e%2e/evil",
            "sound\u0000.pcm",
            "sound name",
            "sound.pcm",
            "-leading-hyphen",
            "_leading-underscore",
            "UPPERCASE",
        ])("should reject the unsafe name %j", name => {
            expect(validateSoundName(name)).toBe(`Sound names can only contain lowercase letters, numbers, hyphens and underscores, and must start with a letter or number.`);
        });

        it("should reject an empty name", () => {
            expect(validateSoundName("")).toBe(`Sound names cannot be empty.`);
        });

        it("should reject an overly long name", () => {
            expect(validateSoundName("a".repeat(MAX_SOUND_NAME_LENGTH))).toBeUndefined();
            expect(validateSoundName("a".repeat(MAX_SOUND_NAME_LENGTH + 1))).toBe(`Sound names cannot be longer than ${MAX_SOUND_NAME_LENGTH} characters.`);
        });
    });

    describe("add-sound command", () => {
        let commands: ReturnType<typeof createAudioCommands>;

        beforeEach(() => {
            vi.clearAllMocks();
            commands = createAudioCommands({
                soundService: mockSoundService,
                discordChatService: mockDiscordChatService,
                commandChoicesService: mockCommandChoicesService,
            });
        });

        it("should not call the sound service for a traversal name", async () => {
            const { interaction, editReply } = createAddSoundInteraction("../../evil", "https://example.com/audio.mp3");

            await commands["add-sound"]!.execute(interaction);

            expect(mockSoundService.addSound).not.toHaveBeenCalled();
            expect(editReply).toHaveBeenCalledWith({ content: expect.stringContaining("Sound names can only contain") });
        });

        it("should add a sound with a valid name, lowercased", async () => {
            const { interaction, editReply } = createAddSoundInteraction("Test-Sound", "https://example.com/audio.mp3");

            await commands["add-sound"]!.execute(interaction);

            expect(mockSoundService.addSound).toHaveBeenCalledWith("test-sound", "https://example.com/audio.mp3");
            expect(editReply).toHaveBeenCalledWith({ content: `Sound "Test-Sound" added successfully!` });
        });
    });
});
