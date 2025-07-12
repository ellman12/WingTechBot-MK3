// ============================================================================
// User Domain Entity - Core Layer
// ============================================================================

export type User = { readonly id: string; readonly username: string; readonly displayName?: string; readonly avatar?: string; readonly isBot: boolean };

export type CreateUserData = User;
export type UpdateUserData = Partial<Omit<User, "id">>;
