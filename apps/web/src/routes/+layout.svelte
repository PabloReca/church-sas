<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { user, tenant, loading, type SessionUser, type Tenant } from '@/lib/stores/auth';
	import { getSession, rpc } from '@/lib/api';

	let { children } = $props();

	const PUBLIC_ROUTES = ['/login', '/setup-tenant'];
	const ADMIN_ONLY_ROUTES = ['/admin'];

	onMount(async () => {
		const sessionUser = await getSession();

		if (sessionUser) {
			user.set(sessionUser);

			// El tenantId ya viene en el JWT
			if (sessionUser.tenantId) {
				tenant.set({
					id: sessionUser.tenantId,
					name: '', // Lo cargamos después si es necesario
					slug: '',
					planId: 0,
					createdAt: '',
				});
			}
		}

		loading.set(false);
	});

	$effect(() => {
		if ($loading) return;

		const path = $page.url.pathname;
		const isPublic = PUBLIC_ROUTES.some((r) => path === r || path.startsWith(r + '/'));
		const isAdminOnly = ADMIN_ONLY_ROUTES.some((r) => path === r || path.startsWith(r + '/'));

		console.log('[MIDDLEWARE]', { path, isPublic, isAdminOnly, user: $user?.userId, isAdmin: $user?.isAdmin });

		if (!$user) {
			if (!isPublic) {
				console.log('[MIDDLEWARE] Not authenticated, redirecting to /login');
				goto('/login');
			}
			return;
		}

		if (isPublic) {
			console.log('[MIDDLEWARE] Authenticated on public route, redirecting to home');
			goto($user.isAdmin ? '/admin' : '/');
			return;
		}

		if (!$user.isAdmin && isAdminOnly) {
			console.log('[MIDDLEWARE] Non-admin trying admin route, redirecting to /');
			goto('/');
			return;
		}

		// Admin without selected tenant should go to admin panel
		if ($user.isAdmin && path === '/' && !$tenant) {
			console.log('[MIDDLEWARE] Admin on home without tenant, redirecting to /admin');
			goto('/admin');
			return;
		}

		console.log('[MIDDLEWARE] Allowing access to', path);
	});
</script>

{#if $loading}
	<div class="flex min-h-screen items-center justify-center bg-gray-50">
		<div class="text-center">
			<div
				class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
			></div>
			<p class="mt-4 text-gray-600">Cargando...</p>
		</div>
	</div>
{:else}
	{@render children()}
{/if}
