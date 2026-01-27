<script lang="ts">
	import { tenant, user } from '@/lib/stores/auth';
	import Navbar from '@/lib/components/Navbar.svelte';
</script>

<div class="min-h-screen bg-custom-dark">
	<Navbar subtitle={$tenant?.name} />

	<main class="mx-auto max-w-7xl p-8">
		<div class="rounded-lg bg-gray-800 p-12 border border-gray-700 text-center">
			<h1 class="text-3xl font-bold text-white">Bienvenido</h1>
			<p class="mt-4 text-gray-400">
				{$user?.email}
			</p>
			<p class="mt-2 text-red-400 font-mono text-sm">DEBUG - User ID: {$user?.userId}</p>
			<p class="mt-1 text-red-400 font-mono text-sm">DEBUG - Platform Admin: {$user?.isAdmin}</p>
			<p class="mt-1 text-red-400 font-mono text-sm">DEBUG - Tenant Admin (owner/admin): {$user?.isTenantAdmin}</p>
			<p class="mt-1 text-red-400 font-mono text-sm">DEBUG - Tenant ID: {$user?.tenantId}</p>
			{#if $tenant}
				<p class="mt-2 text-gray-400">
					Organización: <span class="text-white font-medium">{$tenant.name}</span>
				</p>
			{/if}
		</div>
	</main>
</div>
