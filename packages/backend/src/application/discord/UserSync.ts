import type { RegisterEventHandler } from "@application/discord/EventRegistrar.js";
import type { User } from "@core/entities/User.js";
import type { GuildMemberData, UserSyncService } from "@core/services/UserSyncService.js";
import { type Client, Events, type Guild, type GuildMember, type PartialGuildMember } from "discord.js";

export type UserSync = {
    readonly syncUsers: (client: Client, guild: Guild) => Promise<void>;
    readonly guildMemberAdd: (member: GuildMember) => Promise<void>;
    readonly guildMemberUpdate: (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => Promise<void>;
    readonly guildMemberRemove: (member: GuildMember | PartialGuildMember) => Promise<void>;
};

export type UserSyncDeps = {
    userSyncService: UserSyncService;
};

const toMemberData = (member: GuildMember | PartialGuildMember): GuildMemberData => {
    const { id, username, bot: isBot, createdAt } = member.user;
    return { id, username, isBot, createdAt, joinedAt: member.joinedAt };
};

export const createUserSync = ({ userSyncService }: UserSyncDeps): UserSync => {
    //Resolves ids that only appear in archived message/reaction data, preferring the guild member over the global user.
    const resolveUnknownUsers = async (client: Client, guild: Guild, missingIds: string[]): Promise<User[]> => {
        const guildMembers = await guild.members.fetch({ user: missingIds });

        const users: User[] = [];

        for (const id of missingIds) {
            const member = guildMembers.get(id);
            if (member) {
                users.push(toMemberData(member));
                continue;
            }

            try {
                const user = await client.users.fetch(id);
                const { username, bot: isBot, createdAt } = user;
                users.push({ id, username, isBot, createdAt, joinedAt: null });
            } catch {
                console.warn("[UserSync] Skipping unknown user", id);
            }
        }

        return users;
    };

    const syncUsers = async (client: Client, guild: Guild): Promise<void> => {
        const members = [...(await guild.members.fetch()).values()];
        await userSyncService.syncMembers(members.map(toMemberData));

        const missingIds = await userSyncService.findUnknownUserIds();
        if (missingIds.length === 0) return;

        await userSyncService.addUsers(await resolveUnknownUsers(client, guild, missingIds));
    };

    return {
        syncUsers,
        guildMemberAdd: async member => userSyncService.memberJoined(toMemberData(member)),
        guildMemberUpdate: async (_oldMember, newMember) => userSyncService.memberUpdated({ id: newMember.user.id, username: newMember.user.username }),
        guildMemberRemove: async member => userSyncService.memberLeft(member.user.id),
    };
};

export const registerUserSyncEvents = (userSync: UserSync, registerEventHandler: RegisterEventHandler): void => {
    registerEventHandler(Events.GuildMemberAdd, userSync.guildMemberAdd);
    registerEventHandler(Events.GuildMemberUpdate, userSync.guildMemberUpdate);
    registerEventHandler(Events.GuildMemberRemove, userSync.guildMemberRemove);
};
