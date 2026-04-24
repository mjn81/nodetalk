export const ChannelRole = {
	MEMBER: 0,
	ADMIN: 10,
	OWNER: 20,
} as const;

export type ChannelRoleValue = typeof ChannelRole[keyof typeof ChannelRole];

/**
 * Checks if a role level is at least Admin (10).
 */
export function isAdmin(role: number): boolean {
	return role >= ChannelRole.ADMIN;
}

/**
 * Checks if a role level is Owner (20).
 */
export function isOwner(role: number): boolean {
	return role >= ChannelRole.OWNER;
}

/**
 * Gets a human-readable label for a role.
 */
export function getRoleLabel(role: number): string {
	if (role >= ChannelRole.OWNER) return 'Owner';
	if (role >= ChannelRole.ADMIN) return 'Admin';
	return 'Member';
}
