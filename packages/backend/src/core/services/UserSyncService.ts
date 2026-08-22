import type { User } from "@core/entities/User.js";
import type { MessageRepository } from "@core/ports/repositories/MessageRepository.js";
import type { ReactionRepository } from "@core/ports/repositories/ReactionRepository.js";
import type { UserRepository } from "@core/ports/repositories/UserRepository.js";

//A guild member as plain data. joinedAt is null for someone who is no longer in the guild.
export type GuildMemberData = {
    readonly id: string;
    readonly username: string;
    readonly isBot: boolean;
    readonly createdAt: Date;
    readonly joinedAt: Date | null;
};

export type UserSyncService = {
    //Creates users for members missing from the database and clears joinedAt for stored users no longer in the guild.
    readonly syncMembers: (members: GuildMemberData[]) => Promise<void>;

    //Ids that appear as a message author or a reaction giver/receiver but have no users row.
    readonly findUnknownUserIds: () => Promise<string[]>;

    readonly addUsers: (users: User[]) => Promise<void>;

    readonly memberJoined: (member: GuildMemberData) => Promise<void>;
    readonly memberUpdated: (member: Pick<GuildMemberData, "id" | "username">) => Promise<void>;
    readonly memberLeft: (id: string) => Promise<void>;
};

export type UserSyncServiceDeps = {
    userRepository: UserRepository;
    messageRepository: MessageRepository;
    reactionRepository: ReactionRepository;
};

export const createUserSyncService = ({ userRepository, messageRepository, reactionRepository }: UserSyncServiceDeps): UserSyncService => {
    const syncMembers = async (members: GuildMemberData[]): Promise<void> => {
        const existingUsers = await userRepository.getAll();

        const existingIdsInDb = new Set(existingUsers.map(u => u.id));
        const idsInGuild = new Set(members.map(m => m.id));

        //Add new members in guild not in DB
        const toCreate = members.filter(m => !existingIdsInDb.has(m.id));

        await userRepository.createMany(toCreate);

        //Update joinedAt = null for users in DB but not in guild
        const departed = existingUsers.filter(u => !idsInGuild.has(u.id));

        for (const u of departed) {
            await userRepository.update(u.id, { joinedAt: null });
        }
    };

    const findUnknownUserIds = async (): Promise<string[]> => {
        const authorIds = await messageRepository.getUniqueAuthorIds();
        const reactionUserIds = await reactionRepository.getUniqueUserIds();
        const allIds = new Set([...authorIds, ...reactionUserIds]);

        const existingUsers = await userRepository.findByIds([...allIds]);
        const existingIds = new Set(existingUsers.map(u => u.id));

        return [...allIds].filter(id => !existingIds.has(id));
    };

    const addUsers = async (users: User[]): Promise<void> => {
        await userRepository.createMany(users);
    };

    const memberJoined = async (member: GuildMemberData): Promise<void> => {
        try {
            const existing = await userRepository.findById(member.id);

            if (existing) {
                //Previous member re-joining
                await userRepository.update(member.id, { joinedAt: member.joinedAt });
            } else {
                //New user
                await userRepository.create(member);
            }
        } catch (e: unknown) {
            console.error("Error adding new guild member to users table", member, e);
        }
    };

    const memberUpdated = async ({ id, username }: Pick<GuildMemberData, "id" | "username">): Promise<void> => {
        try {
            const existing = await userRepository.findById(id);

            if (!existing) {
                console.warn("Skipping guildMemberUpdate for nonexistent user", id);
                return;
            }

            await userRepository.update(id, { username });
        } catch (e: unknown) {
            console.error("Error updating guild member", id, e);
        }
    };

    const memberLeft = async (id: string): Promise<void> => {
        try {
            const existing = await userRepository.findById(id);

            if (!existing) {
                console.warn("Skipping guildMemberRemove for nonexistent user", id);
                return;
            }

            await userRepository.update(id, { joinedAt: null });
        } catch (e: unknown) {
            console.error("Error removing guild member", id, e);
        }
    };

    return {
        syncMembers,
        findUnknownUserIds,
        addUsers,
        memberJoined,
        memberUpdated,
        memberLeft,
    };
};
