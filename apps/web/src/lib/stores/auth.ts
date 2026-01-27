import { writable } from 'svelte/store';

// Session user from JWT (no picture, se carga desde profileData)
export interface SessionUser {
	id: string;
	userId: number;
	email: string;
	name: string;
	isAdmin?: boolean;
}

export interface Tenant {
	id: number;
	name: string;
	slug: string;
	planId: number;
	createdAt: Date;
	planName?: string;
	maxSeats?: number;
	maxPeople?: number;
	price?: string;
	currency?: string;
}

export interface TenantUser {
	id: number;
	email: string;
	name: string | null;
	firstLastname: string | null;
	secondLastname: string | null;
	phone: string | null;
	photo: string | null;
	birthdate: string | null;
}

export const user = writable<SessionUser | null>(null);
export const tenant = writable<Tenant | null>(null);
export const loading = writable(true);
