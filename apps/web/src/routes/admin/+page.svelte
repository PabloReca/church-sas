<script lang="ts">
	import { rpc } from '@/lib/api';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Navbar from '@/lib/components/Navbar.svelte';

	interface AdminTenant {
		id: number;
		name: string;
		slug: string;
		planId: number;
		createdAt: Date;
		planName: string;
		maxSeats: number;
		maxPeople: number;
		price: string;
		currency: string;
	}

	interface Plan {
		id: number;
		name: string;
		price: string;
		currency: string;
		maxSeats: number;
		maxPeople: number;
	}

	let tenants: AdminTenant[] = $state([]);
	let plans: Plan[] = $state([]);
	let loading = $state(true);
	let tenantUserCounts: Record<number, number> = $state({});

	// Modal crear tenant
	let showCreateModal = $state(false);
	let newTenantName = $state('');
	let newTenantPlanId = $state<number | null>(null);
	let creating = $state(false);
	let createError = $state('');

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		loading = true;
		try {
			const [tenantsData, plansData] = await Promise.all([
				rpc.tenants.list(),
				rpc.tenants.listPlans()
			]);
			tenants = tenantsData;
			plans = plansData;

			// Set default plan
			if (plansData.length > 0 && !newTenantPlanId) {
				newTenantPlanId = plansData[0].id;
			}

			for (const tenant of tenantsData) {
				try {
					const countData = await rpc.tenants.getPeopleCount({ id: tenant.id });
					tenantUserCounts[tenant.id] = countData.activeSeats || 0;
				} catch (e) {
					console.error(`Error loading people count for tenant ${tenant.id}:`, e);
					tenantUserCounts[tenant.id] = 0;
				}
			}
		} catch (error) {
			console.error('Error loading data:', error);
		} finally {
			loading = false;
		}
	}

	function viewOrganization(tenantId: number) {
		goto(`/admin/organizations/${tenantId}`);
	}

	async function createTenant(e: Event) {
		e.preventDefault();
		createError = '';

		if (!newTenantName.trim()) {
			createError = 'El nombre es requerido';
			return;
		}

		if (!newTenantPlanId) {
			createError = 'Selecciona un plan';
			return;
		}

		creating = true;
		try {
			await rpc.tenants.create({
				name: newTenantName.trim(),
				planId: newTenantPlanId
			});

			newTenantName = '';
			showCreateModal = false;

			await loadData();
		} catch (error) {
			console.error('Error creating tenant:', error);
			createError = 'Error al crear la organización';
		} finally {
			creating = false;
		}
	}

	function closeModal() {
		showCreateModal = false;
		newTenantName = '';
		createError = '';
	}
</script>

<div class="min-h-screen bg-custom-dark">
	<Navbar subtitle="Panel de Administración" />

	<main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		<div class="mb-6 flex items-center justify-between">
			<div>
				<h2 class="text-2xl font-bold text-white">Organizaciones registradas</h2>
				<p class="mt-1 text-sm text-gray-400">
					Gestiona todas las organizaciones en el sistema
				</p>
			</div>
			<button
				onclick={() => showCreateModal = true}
				class="rounded-lg bg-white px-4 py-2 text-sm font-medium text-custom-dark hover:bg-gray-200 transition-colors"
			>
				+ Nueva organización
			</button>
		</div>

		{#if loading}
			<div class="flex items-center justify-center py-12">
				<div class="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
			</div>
		{:else if tenants.length === 0}
			<div class="rounded-lg bg-gray-800 p-6 text-center border border-gray-700">
				<p class="text-gray-400">No hay organizaciones registradas aún</p>
			</div>
		{:else}
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each tenants as tenant}
					<button
						onclick={() => viewOrganization(tenant.id)}
						class="rounded-lg bg-gray-800 p-6 border border-gray-700 hover:border-white transition-all text-left cursor-pointer hover:scale-[1.02]"
					>
						<h3 class="text-lg font-semibold text-white">{tenant.name}</h3>
						<div class="mt-4 space-y-2 text-sm text-gray-400">
							<p><strong class="text-white">Plan:</strong> {tenant.planName}</p>
							<p><strong class="text-white">Asientos activos:</strong> {tenantUserCounts[tenant.id] ?? 0}/{tenant.maxSeats}</p>
							<p><strong class="text-white">Creada:</strong> {new Date(tenant.createdAt).toLocaleDateString('es-ES')}</p>
						</div>
						<div class="mt-4 flex items-center text-white text-sm font-medium">
							<span>Ver detalles</span>
							<svg class="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
							</svg>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</main>
</div>

<!-- Modal crear organización -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="w-full max-w-md rounded-lg bg-gray-800 border border-gray-700 p-6">
			<h3 class="text-xl font-semibold text-white mb-4">Nueva organización</h3>

			<form onsubmit={createTenant} class="space-y-4">
				<div>
					<label for="tenantName" class="block text-sm font-medium text-white mb-1">
						Nombre
					</label>
					<input
						type="text"
						id="tenantName"
						bind:value={newTenantName}
						placeholder="Nombre de la organización"
						class="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white placeholder-gray-400 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
						required
					/>
				</div>

				<div>
					<label for="planId" class="block text-sm font-medium text-white mb-1">
						Plan
					</label>
					{#if plans.length === 0}
						<div class="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-gray-400">
							No hay planes disponibles
						</div>
					{:else}
						<select
							id="planId"
							bind:value={newTenantPlanId}
							class="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
							required
						>
							{#each plans as plan}
								<option value={plan.id}>
									{plan.name} - {plan.maxSeats} asientos - {parseFloat(plan.price) === 0 ? 'Gratis' : `${plan.price}€`}
								</option>
							{/each}
						</select>
					{/if}
				</div>

				{#if createError}
					<div class="rounded-lg bg-red-500/20 border border-red-500/50 p-3 text-sm text-red-400">
						{createError}
					</div>
				{/if}

				<div class="flex gap-3 pt-2">
					<button
						type="button"
						onclick={closeModal}
						class="flex-1 rounded-lg border border-gray-600 px-4 py-2 text-white hover:bg-gray-700 transition-colors"
					>
						Cancelar
					</button>
					<button
						type="submit"
						disabled={creating}
						class="flex-1 rounded-lg bg-white px-4 py-2 text-custom-dark hover:bg-gray-200 transition-colors disabled:opacity-50"
					>
						{creating ? 'Creando...' : 'Crear'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
