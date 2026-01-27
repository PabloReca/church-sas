import type { SessionUser } from '@/lib/stores/auth';

/**
 * Gets the user's initial for avatar display
 * Priority:
 * 1. Name from profile data (DB)
 * 2. Name from Google (session)
 * 3. Email
 * 4. Fallback to 'U'
 */
export function getUserInitial(
	profileName: string | null | undefined,
	sessionUser: SessionUser | null | undefined,
	fallback: string = 'U'
): string {
	const name = profileName?.trim() || sessionUser?.name?.trim() || sessionUser?.email?.trim() || fallback;
	return name.charAt(0).toUpperCase();
}

/**
 * Gets initial from a name string
 * Simpler version for components that only have the final name
 */
export function getInitialFromName(name: string | null | undefined, fallback: string = 'U'): string {
	const trimmed = name?.trim();
	return trimmed ? trimmed.charAt(0).toUpperCase() : fallback;
}

/**
 * Gets the user's display name
 * Priority:
 * 1. Name from profile data (DB)
 * 2. Name from Google (session)
 * 3. Email
 * 4. Empty string
 */
export function getUserDisplayName(
	profileName: string | null | undefined,
	sessionUser: SessionUser | null | undefined
): string {
	return profileName?.trim() || sessionUser?.name?.trim() || sessionUser?.email?.trim() || '';
}
