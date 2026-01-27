<script lang="ts">
	import { page } from '$app/stores';
	import { rpc } from '@/lib/api';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Navbar from '@/lib/components/Navbar.svelte';
	import { getInitialFromName } from '@/lib/utils/user';
	import type { TenantUser } from '@/lib/stores/auth';

	interface AdminTenant {
		id: number;
		name: string;
		slug: string;
		planId: number;
		createdAt: Date;
		planName: string;
		maxSeats: number;
		maxPeople: number;
	}

	const tenantId = parseInt($page.params.id || '0');

	let tenant: AdminTenant | null = $state(null);
	let users: TenantUser[] = $state([]);
	let loading = $state(true);

	onMount(loadData);

	let showAddPersonModal = $state(false);
	let newPersonForm = $state({
		name: '',
		lastname1: '',
		lastname2: '',
		email: '',
		phone: '',
		birthdate: ''
	});
	let addPersonLoading = $state(false);
	let addPersonError = $state('');

	function openUserProfile(u: TenantUser) {
		goto(`/profile/${u.id}`);
	}

	async function addPerson() {
		addPersonError = '';
		if (!newPersonForm.name.trim()) {
			addPersonError = 'El nombre es requerido';
			return;
		}

		addPersonLoading = true;
		try {
			await rpc.people.create({
				tenantId,
				name: newPersonForm.name.trim(),
				lastname1: newPersonForm.lastname1.trim() || undefined,
				lastname2: newPersonForm.lastname2.trim() || undefined,
				email: newPersonForm.email.trim() || undefined,
				phone: newPersonForm.phone.trim() || undefined,
				birthdate: newPersonForm.birthdate || undefined
			});

			newPersonForm = {
				name: '',
				lastname1: '',
				lastname2: '',
				email: '',
				phone: '',
				birthdate: ''
			};
			showAddPersonModal = false;
			await loadData();
		} catch (error) {
			console.error('Error adding person:', error);
			addPersonError = 'Error al crear la persona';
		} finally {
			addPersonLoading = false;
		}
	}



	async function loadData() {
		loading = true;
		try {
			const tenants = await rpc.tenants.list();
			tenant = tenants.find((t) => t.id === tenantId) || null;

			if (!tenant) {
				goto('/admin');
				return;
			}

			const peopleList = await rpc.people.listTenantPeople({ tenantId });
			users = peopleList.map((p) => ({
				id: p.id,
				name: p.name,
				firstLastname: p.lastname1 || '',
				secondLastname: p.lastname2 || '',
				email: p.email || '',
				photo: '',
				phone: p.phone || '',
				birthdate: p.birthdate || null,
				createdAt: p.createdAt
			}));
		} catch (error) {
			console.error('Error loading data:', error);
		} finally {
			loading = false;
		}
	}
</script>

<div class="min-h-screen bg-custom-dark">
	<Navbar
		subtitle={tenant?.name || 'Cargando...'}
		showBack={true}
		backUrl="/admin"
	/>

	<main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		{#if loading}
			<div class="flex items-center justify-center py-12">
				<div class="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
			</div>
		{:else if !tenant}
			<div class="rounded-lg bg-gray-800 p-6 text-center border border-gray-700">
				<p class="text-gray-400">Organización no encontrada</p>
			</div>
		{:else}
			<div class="grid gap-6 lg:grid-cols-3">
				<!-- Información de la organización -->
				<div class="lg:col-span-1">
					<div class="rounded-lg bg-gray-800 p-6 border border-gray-700">
						<h2 class="text-lg font-semibold text-white">Información</h2>
						<div class="mt-4 space-y-3">
							<div>
								<p class="text-xs text-gray-400">Nombre</p>
								<p class="text-sm font-medium text-white">{tenant.name}</p>
							</div>

							<div>
								<p class="text-xs text-gray-400">Personas registradas</p>
								<p class="text-sm font-medium text-white">{users.length}</p>
							</div>
							<div>
								<p class="text-xs text-gray-400">Fecha de creación</p>
								<p class="text-sm font-medium text-white">
									{new Date(tenant.createdAt).toLocaleDateString('es-ES', {
										day: 'numeric',
										month: 'long',
										year: 'numeric'
									})}
								</p>
							</div>
						</div>
					</div>
				</div>

				<!-- Lista de usuarios -->
				<div class="lg:col-span-2">
					<div class="rounded-lg bg-gray-800 border border-gray-700">
						<div class="border-b border-gray-700 px-6 py-4 flex items-center justify-between">
							<h2 class="text-lg font-semibold text-white">
								Usuarios ({users.length})
							</h2>
							<button
								onclick={() => showAddPersonModal = true}
								class="rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
							>
								+ Añadir persona
							</button>
						</div>
						<div class="p-6">
							{#if users.length === 0}
								<p class="text-center text-gray-400 py-8">
									No hay usuarios en esta organización
								</p>
							{:else}
								<div class="space-y-3">
									{#each users as u}
										<button
											onclick={() => openUserProfile(u)}
											class="w-full flex items-center gap-4 rounded-lg border border-gray-700 p-4 hover:bg-gray-700 hover:border-gray-600 transition-colors text-left cursor-pointer"
										>
											{#if u.photo}
												<img src={u.photo} alt={u.name} class="h-12 w-12 rounded-full object-cover" crossorigin="anonymous" />
											{:else}
												<div class="flex h-12 w-12 items-center justify-center rounded-full bg-gray-600 text-white font-semibold">
													{getInitialFromName(u.name)}
												</div>
											{/if}
											<div class="flex-1">
												<p class="font-medium text-white">
													{u.name} {u.firstLastname || ''}
												</p>
												<p class="text-sm text-gray-400">{u.email}</p>
											</div>
											<div class="flex items-center gap-2">
												<svg class="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
												</svg>
											</div>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/if}
	</main>
</div>

<!-- Modal Añadir Persona -->
{#if showAddPersonModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="w-full max-w-md rounded-lg bg-gray-800 border border-gray-700 p-6">
			<h3 class="text-xl font-semibold text-white mb-4">Añadir persona</h3>

			<form onsubmit={(e) => { e.preventDefault(); addPerson(); }} class="space-y-4">
				<div>
					<label for="personName" class="block text-sm font-medium text-white mb-1">
						Nombre *
					</label>
					<input
						type="text"
						id="personName"
						bind:value={newPersonForm.name}
						placeholder="Nombre"
						class="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white placeholder-gray-400 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
						required
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="personLastname1" class="block text-sm font-medium text-white mb-1">
							Primer apellido
						</label>
						<input
							type="text"
							id="personLastname1"
							bind:value={newPersonForm.lastname1}
							placeholder="Primer apellido"
							class="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white placeholder-gray-400 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
						/>
					</div>
					<div>
						<label for="personLastname2" class="block text-sm font-medium text-white mb-1">
							Segundo apellido
						</label>
						<input
							type="text"
							id="personLastname2"
							bind:value={newPersonForm.lastname2}
							placeholder="Segundo apellido"
							class="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white placeholder-gray-400 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
						/>
					</div>
				</div>

				<div>
					<label for="personEmail" class="block text-sm font-medium text-white mb-1">
						Email
					</label>
					<input
						type="email"
						id="personEmail"
						bind:value={newPersonForm.email}
						placeholder="email@example.com"
						class="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white placeholder-gray-400 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
					/>
				</div>

				<div>
					<label for="personPhone" class="block text-sm font-medium text-white mb-1">
						Teléfono
					</label>
					<input
						type="tel"
						id="personPhone"
						bind:value={newPersonForm.phone}
						placeholder="+34 123 456 789"
						class="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white placeholder-gray-400 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
					/>
				</div>

				<div>
					<label for="personBirthdate" class="block text-sm font-medium text-white mb-1">
						Fecha de nacimiento
					</label>
					<input
						type="date"
						id="personBirthdate"
						bind:value={newPersonForm.birthdate}
						class="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
					/>
				</div>

				{#if addPersonError}
					<div class="rounded-lg bg-red-500/20 border border-red-500/50 p-3 text-sm text-red-400">
						{addPersonError}
					</div>
				{/if}

				<div class="flex gap-3 pt-2">
					<button
						type="button"
						onclick={() => showAddPersonModal = false}
						class="flex-1 rounded-lg border border-gray-600 px-4 py-2 text-white hover:bg-gray-700 transition-colors"
					>
						Cancelar
					</button>
					<button
						type="submit"
						disabled={addPersonLoading}
						class="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
					>
						{addPersonLoading ? 'Creando...' : 'Crear'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
