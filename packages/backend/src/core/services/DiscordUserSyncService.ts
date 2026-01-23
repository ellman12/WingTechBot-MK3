import type { User } from "@core/entities/User.js";
import type { MessageRepository } from "@core/repositories/MessageRepository.js";
import type { ReactionRepository } from "@core/repositories/ReactionRepository.js";
import type { UserRepository } from "@core/repositories/UserRepository.js";
import type { Client, Guild, GuildMember, PartialGuildMember } from "discord.js";

export type DiscordUserSyncService = {
    readonly syncUsers: (client: Client, guild: Guild) => Promise<void>;
    readonly guildMemberAdd: (member: GuildMember) => Promise<void>;
    readonly guildMemberUpdate: (member: GuildMember | PartialGuildMember) => Promise<void>;
    readonly guildMemberRemove: (member: GuildMember | PartialGuildMember) => Promise<void>;
};

export const createDiscordUserSyncService = (userRepository: UserRepository, messageRepository: MessageRepository, reactionRepository: ReactionRepository): DiscordUserSyncService => {
    //Sync all current guild members
    const syncCurrentGuildMembers = async (client: Client, guild: Guild): Promise<void> => {
        const members = [...(await guild.members.fetch()).values()];
        const existingUsers = await userRepository.getAll();

        const existingIdsInDb = new Set(existingUsers.map(u => u.id));
        const idsInGuild = new Set(members.map(m => m.id));

        //Add new members in guild not in DB
        const toCreate = members
            .filter(m => !existingIdsInDb.has(m.id))
            .map(m => {
                const { id, username, bot: isBot, createdAt } = m.user;
                return { id, username, isBot, createdAt, joinedAt: m.joinedAt };
            });

        await userRepository.createMany(toCreate);

        //Update joinedAt = null for users in DB but not in guild
        const toUpdateJoinedAtNull = existingUsers.filter(u => !idsInGuild.has(u.id)).map(u => ({ id: u.id, joinedAt: null }));

        for (const u of toUpdateJoinedAtNull) {
            await userRepository.update(u.id, { joinedAt: u.joinedAt });
        }
    };

    //Add users from archived message/reaction data if missing
    const addUsersFromArchivedData = async (client: Client, guild: Guild): Promise<void> => {
        const authorIds = await messageRepository.getUniqueAuthorIds();
        const reactionUserIds = await reactionRepository.getUniqueUserIds();
        const allIds = new Set([...authorIds, ...reactionUserIds]);

        const existingUsers = await userRepository.findByIds([...allIds]);
        const existingIds = new Set(existingUsers.map(u => u.id));

        const missingIds = [...allIds].filter(id => !existingIds.has(id));
        if (missingIds.length === 0) return;

        const guildMembers = await guild.members.fetch({ user: missingIds });

        const toCreate: User[] = [];

        for (const id of missingIds) {
            const member = guildMembers.get(id);
            if (member) {
                const { username, bot: isBot, createdAt } = member.user;
                toCreate.push({ id, username, isBot, createdAt, joinedAt: member.joinedAt });
            } else {
                try {
                    const user = await client.users.fetch(id);
                    const { username, bot: isBot, createdAt } = user;
                    toCreate.push({ id, username, isBot, createdAt, joinedAt: null });
                } catch {
                    console.warn("[DiscordUserSyncService] Skipping unknown user", id);
                }
            }
        }

        await userRepository.createMany(toCreate);
    };

    const syncUsers = async (client: Client, guild: Guild): Promise<void> => {
        await syncCurrentGuildMembers(client, guild);
        await addUsersFromArchivedData(client, guild);
    };

    const guildMemberAdd = async (member: GuildMember): Promise<void> => {
        const { id, username, bot: isBot, createdAt } = member.user;

        try {
            const existing = await userRepository.findById(id);

            if (existing) {
                //Previous member re-joining
                await userRepository.update(id, { joinedAt: member.joinedAt });
            } else {
                //New user
                await userRepository.create({ id, username, isBot, createdAt, joinedAt: member.joinedAt });
            }
        } catch (e: unknown) {
            console.error("Error adding new guild member to users table", member, e);
        }
    };

    const guildMemberUpdate = async (member: GuildMember | PartialGuildMember): Promise<void> => {
        const { id, username } = member.user;

        try {
            const existing = await userRepository.findById(id);

            if (!existing) {
                console.warn("Skipping guildMemberUpdate for nonexistent user", member);
                return;
            }

            await userRepository.update(id, { username });
        } catch (e: unknown) {
            console.error("Error updating guild member", member, e);
        }
    };

    const guildMemberRemove = async (member: GuildMember | PartialGuildMember): Promise<void> => {
        const { id } = member.user;

        try {
            const existing = await userRepository.findById(id);

            if (!existing) {
                console.warn("Skipping guildMemberRemove for nonexistent user", member);
                return;
            }

            await userRepository.update(id, { joinedAt: null });
        } catch (e: unknown) {
            console.error("Error removing guild member", member, e);
        }
    };

    return {
        syncUsers,
        guildMemberAdd,
        guildMemberRemove,
        guildMemberUpdate,
    };
};
