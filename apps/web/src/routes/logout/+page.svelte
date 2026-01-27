<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { user, tenant } from '@/lib/stores/auth';
	import { logout } from '@/lib/api';

	onMount(async () => {
		await logout();
		user.set(null);
		tenant.set(null);
		goto('/login');
	});
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-50">
	<div class="text-center">
		<div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto"></div>
		<p class="mt-4 text-gray-600">Cerrando sesion...</p>
	</div>
</div>
