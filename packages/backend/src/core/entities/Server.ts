export type Server = {
    readonly id: string;
    readonly name: string;
    readonly memberCount: number;
    readonly isAvailable: boolean;
    readonly ownerId: string;
    readonly icon?: string;
    readonly banner?: string;
};
