import { createGuildInDb, findAllGuilds, findGuildById, guildExists } from "@adapters/repositories/KyselyGuildRepository.js";
import { GuildNotFoundError } from "@core/errors/GuildErrors.js";
import { createGuild, getAllGuilds, getGuildById } from "@core/services/GuildService.js";
import type { CreateGuildData, Guild } from "@wingtechbot-mk3/types/entities/guild";
import type { Kysely } from "kysely";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod/v4";

import type { DB } from "../../../../src/generated/database/types";

vi.mock("@adapters/repositories/KyselyGuildRepository.js", () => ({ findGuildById: vi.fn(), findAllGuilds: vi.fn(), createGuildInDb: vi.fn(), updateGuildInDb: vi.fn(), deleteGuildFromDb: vi.fn(), guildExists: vi.fn() }));

describe("GuildService", () => {
    let mockDb: Kysely<DB>;

    beforeEach(() => {
        mockDb = {} as Kysely<DB>;
        vi.clearAllMocks();
    });

    describe("getGuildById", () => {
        it("should return guild when found", async () => {
            const mockGuild: Guild = { id: "test-guild-id", name: "Test Guild", ownerId: "owner-123", memberCount: 100, prefix: "!", isActive: true, createdAt: new Date(), updatedAt: new Date() };

            vi.mocked(findGuildById).mockResolvedValue(mockGuild);

            const result = await getGuildById(mockDb, "test-guild-id");

            expect(result).toEqual(mockGuild);
            expect(findGuildById).toHaveBeenCalledWith(mockDb, "test-guild-id");
        });

        it("should throw GuildNotFoundError when guild not found", async () => {
            vi.mocked(findGuildById).mockResolvedValue(null);

            await expect(getGuildById(mockDb, "non-existent-id")).rejects.toThrow(GuildNotFoundError);
        });
    });

    describe("createGuild", () => {
        it("should create guild successfully", async () => {
            const createData: CreateGuildData = { id: "new-guild-id", name: "New Guild", ownerId: "owner-123", memberCount: 0, prefix: "!", isActive: true };

            const mockCreatedGuild: Guild = { ...createData, memberCount: 0, prefix: "!", isActive: true, createdAt: new Date(), updatedAt: new Date() };

            vi.mocked(guildExists).mockResolvedValue(false);
            vi.mocked(createGuildInDb).mockResolvedValue(mockCreatedGuild);

            const result = await createGuild(mockDb, createData);

            expect(result).toEqual(mockCreatedGuild);
            expect(guildExists).toHaveBeenCalledWith(mockDb, "new-guild-id");
            expect(createGuildInDb).toHaveBeenCalledWith(mockDb, createData);
        });

        it("should throw error when guild already exists", async () => {
            const createData: CreateGuildData = { id: "existing-guild-id", name: "Existing Guild", ownerId: "owner-123", memberCount: 0, prefix: "!", isActive: true };

            vi.mocked(guildExists).mockResolvedValue(true);

            await expect(createGuild(mockDb, createData)).rejects.toThrow("Guild with id existing-guild-id already exists");
        });

        it("should throw ZodError for invalid guild data", async () => {
            const invalidData = { id: "", name: "Valid Name", ownerId: "owner-123" };

            await expect(createGuild(mockDb, invalidData as CreateGuildData)).rejects.toThrow(ZodError);
        });

        it("should throw ZodError for invalid prefix", async () => {
            const invalidData = { id: "guild-id", name: "Valid Name", ownerId: "owner-123", prefix: "too long prefix" };

            await expect(createGuild(mockDb, invalidData as CreateGuildData)).rejects.toThrow(ZodError);
        });

        it("should throw ZodError for prefix with spaces", async () => {
            const invalidData = { id: "guild-id", name: "Valid Name", ownerId: "owner-123", prefix: "! " };

            await expect(createGuild(mockDb, invalidData as CreateGuildData)).rejects.toThrow(ZodError);
        });
    });

    describe("getAllGuilds", () => {
        it("should return all guilds", async () => {
            const mockGuilds: Guild[] = [
                { id: "guild-1", name: "Guild 1", ownerId: "owner-1", memberCount: 50, prefix: "!", isActive: true, createdAt: new Date(), updatedAt: new Date() },
                { id: "guild-2", name: "Guild 2", ownerId: "owner-2", memberCount: 75, prefix: "$", isActive: true, createdAt: new Date(), updatedAt: new Date() },
            ];

            vi.mocked(findAllGuilds).mockResolvedValue(mockGuilds);

            const result = await getAllGuilds(mockDb);

            expect(result).toEqual(mockGuilds);
            expect(findAllGuilds).toHaveBeenCalledWith(mockDb);
        });
    });
});
