<script lang="ts">
	import { onMount } from 'svelte';
	import { user } from '@/lib/stores/auth';
	import { logout, rpc } from '@/lib/api';
	import { goto } from '$app/navigation';
	import { getUserInitial } from '@/lib/utils/user';

	let {
		title = 'Church',
		subtitle = '',
		showBack = false,
		backUrl = '',
		customPhoto = '',
	}: {
		title?: string;
		subtitle?: string;
		showBack?: boolean;
		backUrl?: string;
		customPhoto?: string;
	} = $props();

	let menuOpen = $state(false);
	let menuRef = $state<HTMLDivElement>();
	let hasMultipleTenants = $state(false);

	onMount(async () => {
		if ($user && !$user.isAdmin) {
			try {
				const { data: myTenants } = await rpc.rpc['people-tenants']['my-tenants'].get();
				hasMultipleTenants = (myTenants?.length || 0) > 1;
			} catch (e) {
				console.error('Error checking tenants:', e);
			}
		}
	});

	$effect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (menuOpen && menuRef && !menuRef.contains(e.target as Node)) {
				menuOpen = false;
			}
		};
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});

	async function handleLogout() {
		await logout();
		window.location.href = '/login';
	}

	function goBack() {
		if (backUrl) {
			goto(backUrl);
		} else {
			goto('/');
		}
	}

	let displayPhoto = $derived(customPhoto || '');
	let displayEmail = $derived($user?.email || '');
	let displayInitial = $derived(getUserInitial(null, $user));
</script>

<nav class="bg-custom-dark border-b border-gray-700">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-16 justify-between">
			<div class="flex items-center gap-4">
				{#if showBack}
					<button
						onclick={goBack}
						class="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
						</svg>
						<span class="text-sm">Volver</span>
					</button>
					<div class="h-6 w-px bg-gray-700"></div>
				{/if}
				<h1 class="text-xl font-bold text-white">{title}</h1>
				{#if subtitle}
					<span class="text-gray-500">|</span>
					<span class="text-gray-400">{subtitle}</span>
				{/if}
			</div>
			<div class="flex items-center gap-4 relative" bind:this={menuRef}>
				<button
					onclick={() => menuOpen = !menuOpen}
					class="rounded-full hover:ring-2 hover:ring-white/50 transition-all cursor-pointer"
				>
					{#if displayPhoto}
						<img
							src={displayPhoto}
							alt={displayName}
							class="h-9 w-9 rounded-full object-cover"
							crossorigin="anonymous"
						/>
					{:else}
						<div class="h-9 w-9 rounded-full bg-gray-600 flex items-center justify-center text-white font-medium">
							{displayInitial}
						</div>
					{/if}
				</button>

				{#if menuOpen}
					<div class="absolute right-0 top-12 w-56 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50">
						<div class="px-4 py-3 border-b border-gray-700">
							<p class="text-sm font-medium text-white">Mi perfil</p>
							<p class="text-xs text-gray-400">{displayEmail}</p>
						</div>
						<div class="py-1">
							{#if $user?.isAdmin}
								<button
									onclick={() => { menuOpen = false; goto('/admin'); }}
									class="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
									</svg>
									Admin Dashboard
								</button>
							{/if}
							<button
								onclick={() => { menuOpen = false; goto(`/profile/${$user?.userId}`); }}
								class="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
							>
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
								</svg>
								Mi perfil
							</button>
							{#if hasMultipleTenants || $user?.isAdmin}
								<button
									onclick={() => { menuOpen = false; goto('/switch-tenant'); }}
									class="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
									</svg>
									Cambiar organización
								</button>
							{/if}
						</div>
						<div class="border-t border-gray-700 py-1">
							<button
								onclick={handleLogout}
								class="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2"
							>
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
								</svg>
								Cerrar sesión
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</nav>
