<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { user, tenant, type Tenant } from '@/lib/stores/auth';
	import { rpc } from '@/lib/api';
	import { getUserInitial } from '@/lib/utils/user';

	interface MyTenant {
		tenantId: number;
		tenantName: string;
		slug: string;
		planId: number;
		createdAt: Date;
		isPrimary: boolean;
	}

	let myTenants: MyTenant[] = $state([]);
	let showJoinForm = $state(false);
	let inviteCode = $state('');
	let error = $state('');
	let loading = $state(false);
	let loadingTenants = $state(true);

	onMount(async () => {
		if ($user) {
			try {
				const { data } = await rpc.rpc['people-tenants']['my-tenants'].get();
				myTenants = data || [];
			} catch (e) {
				console.error('Error loading tenants:', e);
			}
		}
		loadingTenants = false;
	});

	async function selectTenant(tenantId: number) {
		const t = myTenants.find(t => t.tenantId === tenantId);
		if (t) {
			localStorage.setItem('tenant_id', tenantId.toString());
			const tenantsList = await rpc.tenants.list();
			const fullTenant = tenantsList.find((te) => te.id === tenantId);
			if (fullTenant) {
				const tenantObj: Tenant = {
					id: fullTenant.id,
					name: fullTenant.name,
					slug: fullTenant.slug,
					planId: fullTenant.planId,
					createdAt: fullTenant.createdAt,
					maxSeats: fullTenant.maxSeats,
					maxPeople: fullTenant.maxPeople,
				};
				tenant.set(tenantObj);
			}
			goto('/');
		}
	}

	async function handleJoin(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;

		const code = inviteCode.toUpperCase().trim();
		if (!code) {
			error = 'Introduce un codigo de invitacion';
			loading = false;
			return;
		}

		try {
			const result = await rpc.invitations.join({ inviteCode: code });

			if (result.tenant) {
				localStorage.setItem('tenant_id', result.tenant.id.toString());
				tenant.set({
					id: result.tenant.id,
					name: result.tenant.name,
					slug: result.tenant.slug,
					planId: result.tenant.planId,
					createdAt: result.tenant.createdAt,
				});
				goto('/');
			}
		} catch (e: unknown) {
			console.error('Join error:', e);
			const err = e as { code?: string; message?: string };
			if (err.code === 'NOT_FOUND') {
				error = 'Código de invitación no válido';
			} else if (err.code === 'CONFLICT') {
				error = 'Ya eres miembro de esta organización';
			} else if (err.code === 'BAD_REQUEST') {
				error = 'Este código de invitación ha expirado o ya ha sido usado';
			} else {
				error = 'Error al unirse a la organización';
			}
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-custom-dark">
	<div class="w-full max-w-md space-y-6 rounded-lg bg-gray-800 p-8 border border-gray-700">
		<div class="text-center">
			<h2 class="text-2xl font-bold text-white">Mis organizaciones</h2>
			<p class="mt-2 text-sm text-gray-400">
				Selecciona una organización o únete a una nueva
			</p>
		</div>

		<div class="flex items-center gap-3 rounded-lg bg-gray-700 p-3">
			<div class="h-10 w-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-medium">
				{getUserInitial(null, $user)}
			</div>
			<div>
				<div class="font-medium text-white">{$user?.name}</div>
				<div class="text-sm text-gray-400">{$user?.email}</div>
			</div>
		</div>

		{#if loadingTenants}
			<p class="text-center text-gray-400">Cargando organizaciones...</p>
		{:else}
			{#if myTenants.length > 0}
				<div class="space-y-2">
					{#each myTenants as t}
						<button
							onclick={() => selectTenant(t.tenantId)}
							class="flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors
								{t.tenantId === $tenant?.id
									? 'border-white bg-white/10'
									: 'border-gray-700 hover:border-gray-500 hover:bg-gray-700'}"
						>
							<div>
								<div class="font-medium text-white">{t.tenantName}</div>
								{#if t.isPrimary}
									<div class="text-sm text-gray-400">Organización principal</div>
								{:else}
									<div class="text-sm text-gray-400">Auxiliar</div>
								{/if}
							</div>
							{#if t.tenantId === $tenant?.id}
								<span class="rounded-full bg-white/20 px-2 py-1 text-xs text-white">
									Actual
								</span>
							{/if}
						</button>
					{/each}
				</div>

				<div class="relative">
					<div class="absolute inset-0 flex items-center">
						<div class="w-full border-t border-gray-700"></div>
					</div>
					<div class="relative flex justify-center text-sm">
						<span class="bg-gray-800 px-2 text-gray-400">o</span>
					</div>
				</div>
			{/if}

			{#if !showJoinForm}
				<button
					onclick={() => showJoinForm = true}
					class="w-full rounded-lg border-2 border-dashed border-gray-600 p-4 text-gray-400 transition-colors hover:border-white hover:text-white"
				>
					+ Unirse a otra organización
				</button>
			{:else}
				<form onsubmit={handleJoin} class="space-y-4 rounded-lg bg-gray-700 p-4">
					<div>
						<label for="inviteCode" class="block text-sm font-medium text-white">
							Código de invitación
						</label>
						<input
							type="text"
							id="inviteCode"
							bind:value={inviteCode}
							placeholder="XXXXXXXX"
							class="mt-1 block w-full rounded-lg border border-gray-600 bg-gray-800 px-4 py-3 text-center font-mono uppercase tracking-widest text-white focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
							required
							autocomplete="off"
						/>
					</div>

					{#if error}
						<div class="rounded-lg bg-red-500/20 border border-red-500/50 p-3 text-sm text-red-400">
							{error}
						</div>
					{/if}

					<div class="flex gap-3">
						<button
							type="button"
							onclick={() => showJoinForm = false}
							class="flex-1 rounded-lg border border-gray-600 px-4 py-2 text-white hover:bg-gray-600"
						>
							Cancelar
						</button>
						<button
							type="submit"
							disabled={loading}
							class="flex-1 rounded-lg bg-white px-4 py-2 text-gray-900 hover:bg-gray-200 disabled:opacity-50"
						>
							{loading ? 'Verificando...' : 'Unirse'}
						</button>
					</div>
				</form>
			{/if}
		{/if}

		<div class="flex justify-between text-sm">
			<a href="/" class="text-gray-400 hover:text-white">
				Volver
			</a>
			<a href="/logout" class="text-red-400 hover:text-red-300">
				Cerrar sesión
			</a>
		</div>
	</div>
</div>
