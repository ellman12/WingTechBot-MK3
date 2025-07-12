// ============================================================================
// User Domain Entity - Core Layer
// ============================================================================

export interface User {
    readonly id: string;
    readonly username: string;
    readonly displayName?: string;
    readonly avatar?: string;
    readonly isBot: boolean;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

export interface CreateUserData {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
    isBot?: boolean;
}

export interface UpdateUserData {
    username?: string;
    displayName?: string;
    avatar?: string;
    isBot?: boolean;
}

// Domain validation and business rules
export class UserEntity {
    constructor(private readonly data: User) {}

    static create(data: CreateUserData): User {
        // Business validation
        if (!data.id?.trim()) {
            throw new Error("User ID is required");
        }

        if (!data.username?.trim()) {
            throw new Error("Username is required");
        }

        if (data.username.length > 255) {
            throw new Error("Username cannot exceed 255 characters");
        }

        if (data.displayName && data.displayName.length > 255) {
            throw new Error("Display name cannot exceed 255 characters");
        }

        const now = new Date();

        return { id: data.id.trim(), username: data.username.trim(), ...(data.displayName && { displayName: data.displayName.trim() }), ...(data.avatar && { avatar: data.avatar }), isBot: data.isBot ?? false, createdAt: now, updatedAt: now };
    }

    // Business methods
    update(data: UpdateUserData): User {
        const updates: { updatedAt: Date; username?: string; displayName?: string; avatar?: string; isBot?: boolean } = { updatedAt: new Date() };

        if (data.username !== undefined) {
            if (!data.username?.trim()) {
                throw new Error("Username cannot be empty");
            }
            if (data.username.length > 255) {
                throw new Error("Username cannot exceed 255 characters");
            }
            updates.username = data.username.trim();
        }

        if (data.displayName !== undefined) {
            if (data.displayName && data.displayName.length > 255) {
                throw new Error("Display name cannot exceed 255 characters");
            }
            updates.displayName = data.displayName?.trim();
        }

        if (data.avatar !== undefined) {
            updates.avatar = data.avatar;
        }

        if (data.isBot !== undefined) {
            updates.isBot = data.isBot;
        }

        return { ...this.data, ...updates };
    }

    // Domain logic
    isActive(): boolean {
        return !this.data.isBot;
    }

    hasAvatar(): boolean {
        return !!this.data.avatar;
    }

    getDisplayName(): string {
        return this.data.displayName || this.data.username;
    }

    // Getters
    get id(): string {
        return this.data.id;
    }
    get username(): string {
        return this.data.username;
    }
    get displayName(): string | undefined {
        return this.data.displayName;
    }
    get avatar(): string | undefined {
        return this.data.avatar;
    }
    get isBot(): boolean {
        return this.data.isBot;
    }
    get createdAt(): Date {
        return this.data.createdAt;
    }
    get updatedAt(): Date {
        return this.data.updatedAt;
    }
}
