import type { User } from "@core/entities/User.js";
import type { MessageRepository } from "@core/ports/repositories/MessageRepository.js";
import type { ReactionRepository } from "@core/ports/repositories/ReactionRepository.js";
import type { UserRepository } from "@core/ports/repositories/UserRepository.js";
import { type GuildMemberData, createUserSyncService } from "@core/services/UserSyncService.js";
import { describe, expect, it, vi } from "vitest";

const createdAt = new Date("2020-01-01T00:00:00Z");
const joinedAt = new Date("2021-01-01T00:00:00Z");

const user = (id: string, overrides: Partial<User> = {}): User => ({ id, username: `user-${id}`, isBot: false, createdAt, joinedAt, ...overrides });

const member = (id: string, overrides: Partial<GuildMemberData> = {}): GuildMemberData => ({ id, username: `user-${id}`, isBot: false, createdAt, joinedAt, ...overrides });

const userRepositoryStub = (existing: User[] = []): UserRepository => ({
    findById: vi.fn(async id => existing.find(u => u.id === id)),
    findByIds: vi.fn(async ids => existing.filter(u => ids.includes(u.id))),
    findByUsername: vi.fn(async username => existing.find(u => u.username === username)),
    getAll: vi.fn(async () => existing),
    create: vi.fn(async data => data),
    createMany: vi.fn(async data => data),
    update: vi.fn(async id => existing.find(u => u.id === id)),
});

const messageRepositoryStub = (authorIds: string[] = []) => ({ getUniqueAuthorIds: vi.fn(async () => authorIds) }) as unknown as MessageRepository;

const reactionRepositoryStub = (userIds: string[] = []) => ({ getUniqueUserIds: vi.fn(async () => userIds) }) as unknown as ReactionRepository;

const createService = (userRepository: UserRepository, messageRepository = messageRepositoryStub(), reactionRepository = reactionRepositoryStub()) => createUserSyncService({ userRepository, messageRepository, reactionRepository });

describe("UserSyncService.syncMembers", () => {
    it("creates only the members missing from the database", async () => {
        const userRepository = userRepositoryStub([user("1")]);
        const service = createService(userRepository);

        await service.syncMembers([member("1"), member("2")]);

        expect(userRepository.createMany).toHaveBeenCalledWith([member("2")]);
    });

    it("nulls joinedAt for stored users no longer in the guild", async () => {
        const userRepository = userRepositoryStub([user("1"), user("2")]);
        const service = createService(userRepository);

        await service.syncMembers([member("1")]);

        expect(userRepository.update).toHaveBeenCalledTimes(1);
        expect(userRepository.update).toHaveBeenCalledWith("2", { joinedAt: null });
    });

    it("does nothing when the guild and the database already agree", async () => {
        const userRepository = userRepositoryStub([user("1")]);
        const service = createService(userRepository);

        await service.syncMembers([member("1")]);

        expect(userRepository.createMany).toHaveBeenCalledWith([]);
        expect(userRepository.update).not.toHaveBeenCalled();
    });
});

describe("UserSyncService.findUnknownUserIds", () => {
    it("returns author and reactor ids with no users row, deduplicated", async () => {
        const userRepository = userRepositoryStub([user("1")]);
        const service = createService(userRepository, messageRepositoryStub(["1", "2"]), reactionRepositoryStub(["2", "3"]));

        expect(await service.findUnknownUserIds()).toEqual(["2", "3"]);
    });

    it("returns nothing when every id is known", async () => {
        const userRepository = userRepositoryStub([user("1"), user("2")]);
        const service = createService(userRepository, messageRepositoryStub(["1"]), reactionRepositoryStub(["2"]));

        expect(await service.findUnknownUserIds()).toEqual([]);
    });
});

describe("UserSyncService member events", () => {
    it("creates a user the first time they join", async () => {
        const userRepository = userRepositoryStub();
        const service = createService(userRepository);

        await service.memberJoined(member("1"));

        expect(userRepository.create).toHaveBeenCalledWith(member("1"));
        expect(userRepository.update).not.toHaveBeenCalled();
    });

    it("restores joinedAt when a previous member re-joins", async () => {
        const userRepository = userRepositoryStub([user("1", { joinedAt: null })]);
        const service = createService(userRepository);

        await service.memberJoined(member("1"));

        expect(userRepository.create).not.toHaveBeenCalled();
        expect(userRepository.update).toHaveBeenCalledWith("1", { joinedAt });
    });

    it("updates the username of a known member", async () => {
        const userRepository = userRepositoryStub([user("1")]);
        const service = createService(userRepository);

        await service.memberUpdated({ id: "1", username: "renamed" });

        expect(userRepository.update).toHaveBeenCalledWith("1", { username: "renamed" });
    });

    it("skips updates for unknown members", async () => {
        const userRepository = userRepositoryStub();
        const service = createService(userRepository);

        await service.memberUpdated({ id: "1", username: "renamed" });

        expect(userRepository.update).not.toHaveBeenCalled();
    });

    it("nulls joinedAt when a known member leaves", async () => {
        const userRepository = userRepositoryStub([user("1")]);
        const service = createService(userRepository);

        await service.memberLeft("1");

        expect(userRepository.update).toHaveBeenCalledWith("1", { joinedAt: null });
    });

    it("skips removals for unknown members", async () => {
        const userRepository = userRepositoryStub();
        const service = createService(userRepository);

        await service.memberLeft("1");

        expect(userRepository.update).not.toHaveBeenCalled();
    });
});
