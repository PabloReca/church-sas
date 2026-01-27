<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { user, tenant } from '@/lib/stores/auth';
	import { rpc } from '@/lib/api';
	import Navbar from '@/lib/components/Navbar.svelte';

	let loading = $state(true);
	let person: any = $state(null);
	let showDeleteConfirm = $state(false);

	let personId = $derived(parseInt($page.params.id));
	let isOwnProfile = $derived($user?.userId === personId);
	let canEdit = $derived($user?.isTenantAdmin || isOwnProfile);

	onMount(async () => {
		if (!$user || !$tenant) {
			goto('/login');
			return;
		}

		const targetPersonId = parseInt($page.params.id);

		// Usuarios normales solo pueden ver su propio perfil
		if (!$user.isTenantAdmin && $user.userId !== targetPersonId) {
			goto(`/profile/${$user.userId}`);
			return;
		}

		try {
			// Cargar datos de la persona (ya incluye los campos)
			const { data, error } = await rpc.rpc.people[targetPersonId].get();

			if (error || !data) {
				console.error('Error loading profile:', error);
				person = null;
			} else {
				person = data;
				// Los campos ya vienen en person.fields
			}
		} catch (error) {
			console.error('Error loading profile:', error);
		} finally {
			loading = false;
		}
	});

	async function deleteAccount() {
		const targetPersonId = parseInt($page.params.id);
		if ($user?.userId !== targetPersonId) return;

		try {
			await rpc.rpc.people[targetPersonId].delete();
			await goto('/logout');
		} catch (error) {
			console.error('Error deleting account:', error);
			alert('Error al borrar la cuenta. Contacta con soporte.');
		}
	}
</script>

<div class="min-h-screen bg-custom-dark">
	<Navbar />

	<div class="mx-auto max-w-4xl p-6">
		{#if loading}
			<div class="flex items-center justify-center py-12">
				<div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
			</div>
		{:else if person}
			<div class="rounded-lg border border-gray-700 bg-gray-800 p-6">
				<div class="mb-6 flex items-center justify-between">
					<div>
						<h1 class="text-2xl font-bold text-white">
							{isOwnProfile ? 'Mi Perfil' : 'Perfil de Usuario'}
						</h1>
						<p class="mt-1 text-sm text-gray-400">{person.email}</p>
					</div>
					{#if isOwnProfile}
						<button
							onclick={() => showDeleteConfirm = true}
							class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
						>
							Borrar mi cuenta
						</button>
					{/if}
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
					<!-- Rol -->
					<div class="rounded-lg bg-gray-700 p-4">
						<div class="text-sm text-gray-400">Rol en la organización</div>
						<div class="mt-1 text-white font-medium">
							{#if person.role === 'owner'}
								Propietario
							{:else if person.role === 'admin'}
								Administrador
							{:else}
								Miembro
							{/if}
						</div>
					</div>

					<!-- Usuario activo (puede hacer login) -->
					<div class="rounded-lg bg-gray-700 p-4">
						<div class="text-sm text-gray-400">Acceso al sistema</div>
						<div class="mt-1 text-white font-medium">
							{person.isActive ? 'Usuario activo (puede hacer login)' : 'Sin acceso al sistema'}
						</div>
					</div>

					<!-- Miembro de la iglesia -->
					<div class="rounded-lg bg-gray-700 p-4">
						<div class="text-sm text-gray-400">Membresía</div>
						<div class="mt-1 text-white font-medium">
							{person.isMember ? 'Miembro de la iglesia' : 'No es miembro'}
						</div>
					</div>

					<!-- Tenant ID -->
					<div class="rounded-lg bg-gray-700 p-4">
						<div class="text-sm text-gray-400">Organización principal</div>
						<div class="mt-1 text-white font-medium">
							Tenant ID: {person.tenantId}
						</div>
					</div>
				</div>

				<!-- Campos dinámicos -->
				<div class="space-y-4">
					<h2 class="text-lg font-semibold text-white">Información Personal</h2>

					{#if !person.fields || Object.keys(person.fields).length === 0}
						<p class="text-gray-400">No hay campos personalizados configurados.</p>
					{:else}
						{#each Object.entries(person.fields) as [fieldName, value]}
							<div class="rounded-lg bg-gray-700 p-4">
								<div class="text-sm font-medium text-gray-300">{fieldName}</div>
								<div class="mt-1 text-white">
									{value || '—'}
								</div>
							</div>
						{/each}
					{/if}
				</div>

				{#if !canEdit}
					<div class="mt-6 rounded-lg bg-blue-500/20 border border-blue-500/50 p-4">
						<p class="text-sm text-blue-300">
							Solo puedes ver tu perfil. Para modificar tus datos, contacta con un administrador.
						</p>
					</div>
				{/if}
			</div>
		{:else}
			<div class="rounded-lg border border-gray-700 bg-gray-800 p-6">
				<p class="text-gray-400">No se pudo cargar el perfil.</p>
			</div>
		{/if}
	</div>
</div>

<!-- Modal de confirmación de borrado -->
{#if showDeleteConfirm}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="w-full max-w-md rounded-lg border border-gray-700 bg-gray-800 p-6">
			<h3 class="text-xl font-bold text-white">¿Borrar mi cuenta?</h3>
			<p class="mt-2 text-sm text-gray-400">
				Esta acción es permanente y no se puede deshacer. Perderás acceso a todas las organizaciones.
			</p>
			<div class="mt-6 flex gap-3">
				<button
					onclick={() => showDeleteConfirm = false}
					class="flex-1 rounded-lg bg-gray-700 px-4 py-2 text-white hover:bg-gray-600"
				>
					Cancelar
				</button>
				<button
					onclick={deleteAccount}
					class="flex-1 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
				>
					Sí, borrar mi cuenta
				</button>
			</div>
		</div>
	</div>
{/if}
