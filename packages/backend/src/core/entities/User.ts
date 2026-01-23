export type User = {
    readonly id: string;
    readonly username: string;
    readonly isBot: boolean;
    readonly createdAt: Date;
    readonly joinedAt: Date | null;
};

export type CreateUserData = User;
export type UpdateUserData = Partial<Pick<User, "username" | "joinedAt">>;
