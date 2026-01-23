import { createUserRepository } from "@adapters/repositories/UserRepository.js";
import type { CreateUserData } from "@core/entities/User.js";

import { createTestDb } from "../../utils/testUtils.js";

describe.concurrent("createUser", () => {
    test("creates a user and returns the created entity", async () => {
        const db = await createTestDb();
        const users = createUserRepository(db);

        const data: CreateUserData = { id: "user-1", username: "alice", isBot: false, createdAt: new Date(), joinedAt: new Date() };
        const user = await users.create(data);

        expect(user).toEqual({ id: data.id, username: data.username, isBot: false, createdAt: data.createdAt, joinedAt: data.joinedAt });
    });
});

describe.concurrent("createManyUsers", () => {
    test("returns empty array when no users are provided", async () => {
        const db = await createTestDb();
        const users = createUserRepository(db);

        const result = await users.createMany([]);
        expect(result).toEqual([]);
    });

    test("creates multiple users and returns created entities", async () => {
        const db = await createTestDb();
        const users = createUserRepository(db);

        const data: CreateUserData[] = [
            { id: "user-13", username: "kate", isBot: false, createdAt: new Date(), joinedAt: new Date() },
            { id: "user-14", username: "luke", isBot: true, createdAt: new Date(), joinedAt: new Date() },
        ];

        const created = await users.createMany(data);

        expect(created).toHaveLength(2);

        expect(created).toEqual(
            expect.arrayContaining(
                data.map(d => ({
                    id: d.id,
                    username: d.username,
                    isBot: d.isBot,
                    createdAt: d.createdAt,
                    joinedAt: d.joinedAt,
                }))
            )
        );

        const allUsers = await users.getAll();
        expect(allUsers).toHaveLength(2);
    });
});

describe.concurrent("findUserById", () => {
    test("returns undefined when user does not exist", async () => {
        const db = await createTestDb();
        const users = createUserRepository(db);

        const user = await users.findById("missing-id");
        expect(user).toBeUndefined();
    });

    test("returns user when user exists", async () => {
        const db = await createTestDb();
        const users = createUserRepository(db);

        const created = await users.create({ id: "user-2", username: "bob", isBot: false, createdAt: new Date(), joinedAt: new Date() });

        const found = await users.findById(created.id);
        expect(found).toEqual(created);
    });
});

describe.concurrent("findUsersByIds", () => {
    test("returns empty array when no ids are provided", async () => {
        const db = await createTestDb();
        const users = createUserRepository(db);

        const result = await users.findByIds([]);
        expect(result).toEqual([]);
    });

    test("returns empty array when none of the users exist", async () => {
        const db = await createTestDb();
        const users = createUserRepository(db);

        const result = await users.findByIds(["missing-1", "missing-2"]);
        expect(result).toEqual([]);
    });

    test("returns only users that exist", async () => {
        const db = await createTestDb();
        const users = createUserRepository(db);

        const user1 = await users.create({ id: "user-11", username: "alice", isBot: false, createdAt: new Date(), joinedAt: new Date() });
        const user2 = await users.create({ id: "user-12", username: "bob", isBot: false, createdAt: new Date(), joinedAt: new Date() });

        const result = await users.findByIds([user1.id, "missing", user2.id]);

        expect(result).toHaveLength(2);
        expect(result).toEqual(expect.arrayContaining([user1, user2]));
    });
});

describe.concurrent("findUserByUsername", () => {
    test("returns undefined when username does not exist", async () => {
        const db = await createTestDb();
        const users = createUserRepository(db);

        const user = await users.findByUsername("unknown");
        expect(user).toBeUndefined();
    });

    test("returns user when username exists", async () => {
        const db = await createTestDb();
        const users = createUserRepository(db);

        const created = await users.create({ id: "user-3", username: "charlie", isBot: false, createdAt: new Date(), joinedAt: new Date() });

        const found = await users.findByUsername("charlie");
        expect(found).toEqual(created);
    });
});

describe.concurrent("getAllUsers", () => {
    test("returns empty array when no users exist", async () => {
        const db = await createTestDb();
        const users = createUserRepository(db);

        const allUsers = await users.getAll();
        expect(allUsers).toEqual([]);
    });

    test("returns all created users", async () => {
        const db = await createTestDb();
        const users = createUserRepository(db);

        const user1 = await users.create({ id: "user-4", username: "dave", isBot: false, createdAt: new Date(), joinedAt: new Date() });
        const user2 = await users.create({ id: "user-5", username: "eve", isBot: false, createdAt: new Date(), joinedAt: new Date() });

        const allUsers = await users.getAll();
        expect(allUsers).toHaveLength(2);
        expect(allUsers).toEqual(expect.arrayContaining([user1, user2]));
    });
});

describe.concurrent("updateUser", () => {
    test("returns undefined when updating a non-existent user", async () => {
        const db = await createTestDb();
        const users = createUserRepository(db);

        const updated = await users.update("missing-id", { username: "new-name" });
        expect(updated).toBeUndefined();
    });

    test("updates an existing user and returns updated entity", async () => {
        const db = await createTestDb();
        const users = createUserRepository(db);

        const created1 = await users.create({ id: "user-6", username: "frank", isBot: false, createdAt: new Date(), joinedAt: new Date() });
        const updated1 = await users.update(created1.id, { username: "frank_updated" });

        expect(updated1).not.toBeUndefined();
        expect(updated1!.id).toBe(created1.id);
        expect(updated1!.username).toBe("frank_updated");
        expect(updated1!.createdAt).toEqual(created1.createdAt);
        expect(updated1!.joinedAt).toEqual(created1.joinedAt);

        const created2 = await users.create({ id: "user-10", username: "bob", isBot: false, createdAt: new Date(), joinedAt: new Date() });
        const updated2 = await users.update(created2.id, { joinedAt: null });

        expect(updated2).not.toBeUndefined();
        expect(updated2!.id).toBe(created2.id);
        expect(updated2!.username).toBe("bob");
        expect(updated2!.createdAt).toEqual(created2.createdAt);
        expect(updated2!.joinedAt).toEqual(null);
    });
});
