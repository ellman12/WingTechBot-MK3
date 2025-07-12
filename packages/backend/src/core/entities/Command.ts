// ============================================================================
// Command Domain Entity - Core Layer
// ============================================================================

export interface Command {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
    readonly userId: string;
    readonly arguments?: string; // JSON serialized arguments
    readonly executedAt: Date;
    readonly success: boolean;
    readonly error?: string;
}

export interface CreateCommandData {
    name: string;
    description?: string;
    userId: string;
    arguments?: string;
    success: boolean;
    error?: string;
}

export interface UpdateCommandData {
    name?: string;
    description?: string;
    userId?: string;
    arguments?: string;
    success?: boolean;
    error?: string;
}

// Domain validation and business rules
export class CommandEntity {
    constructor(private readonly data: Command) {}

    static create(data: CreateCommandData): Command {
        // Business validation
        if (!data.name?.trim()) {
            throw new Error("Command name is required");
        }

        if (!data.userId?.trim()) {
            throw new Error("User ID is required");
        }

        if (data.name.length > 255) {
            throw new Error("Command name cannot exceed 255 characters");
        }

        if (data.description && data.description.length > 1000) {
            throw new Error("Command description cannot exceed 1000 characters");
        }

        const now = new Date();

        return {
            id: this.generateId(),
            name: data.name.trim(),
            ...(data.description && { description: data.description.trim() }),
            userId: data.userId.trim(),
            ...(data.arguments && { arguments: data.arguments }),
            executedAt: now,
            success: data.success,
            ...(data.error && { error: data.error }),
        };
    }

    // Business methods
    update(data: UpdateCommandData): Command {
        const updates: { name?: string; description?: string; userId?: string; arguments?: string; success?: boolean; error?: string } = {};

        if (data.name !== undefined) {
            if (!data.name?.trim()) {
                throw new Error("Command name cannot be empty");
            }
            if (data.name.length > 255) {
                throw new Error("Command name cannot exceed 255 characters");
            }
            updates.name = data.name.trim();
        }

        if (data.description !== undefined) {
            if (data.description && data.description.length > 1000) {
                throw new Error("Command description cannot exceed 1000 characters");
            }
            updates.description = data.description?.trim();
        }

        if (data.userId !== undefined) {
            if (!data.userId?.trim()) {
                throw new Error("User ID cannot be empty");
            }
            updates.userId = data.userId.trim();
        }

        if (data.arguments !== undefined) {
            updates.arguments = data.arguments;
        }

        if (data.success !== undefined) {
            updates.success = data.success;
        }

        if (data.error !== undefined) {
            updates.error = data.error;
        }

        return { ...this.data, ...updates };
    }

    // Domain logic
    isSuccessful(): boolean {
        return this.data.success;
    }

    hasError(): boolean {
        return !!this.data.error;
    }

    hasArguments(): boolean {
        return !!this.data.arguments;
    }

    getArgumentsAsObject(): Record<string, unknown> | null {
        if (!this.data.arguments) {
            return null;
        }

        try {
            return JSON.parse(this.data.arguments);
        } catch {
            return null;
        }
    }

    // Getters
    get id(): string {
        return this.data.id;
    }
    get name(): string {
        return this.data.name;
    }
    get description(): string | undefined {
        return this.data.description;
    }
    get userId(): string {
        return this.data.userId;
    }
    get arguments(): string | undefined {
        return this.data.arguments;
    }
    get executedAt(): Date {
        return this.data.executedAt;
    }
    get success(): boolean {
        return this.data.success;
    }
    get error(): string | undefined {
        return this.data.error;
    }

    // Private methods
    private static generateId(): string {
        return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
