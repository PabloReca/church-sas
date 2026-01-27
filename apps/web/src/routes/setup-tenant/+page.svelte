<script lang="ts">
	import { signInWithGoogle } from '@/lib/api';

	const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

	let submitting = $state(false);
	let error = $state('');

	let tenantName = $state('');
	let ownerEmail = $state('');

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		submitting = true;

		try {
			const res = await fetch(`${API_URL}/auth/create-tenant`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					tenantName: tenantName.trim(),
					ownerEmail: ownerEmail.trim().toLowerCase(),
				}),
			});

			const data = await res.json();

			if (!res.ok) {
				error = data.error || 'Error al crear la organización';
				return;
			}

			// Success - redirect to Google login
			signInWithGoogle();
		} catch {
			error = 'Error de conexión';
		} finally {
			submitting = false;
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-background">
	<div class="w-full max-w-md space-y-6 rounded-lg bg-card p-8 border border-border">
		<div class="text-center">
			<h2 class="text-2xl font-bold text-foreground">Crea tu organización</h2>
			<p class="mt-2 text-sm text-muted-foreground">
				Configura tu espacio para gestionar tu comunidad
			</p>
		</div>

		<form onsubmit={handleSubmit} class="space-y-4">
			<div>
				<label for="tenantName" class="block text-sm font-medium text-foreground">
					Nombre de tu organización
				</label>
				<input
					type="text"
					id="tenantName"
					bind:value={tenantName}
					placeholder="Ej: Iglesia Vida Nueva"
					class="mt-1 block w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
					required
				/>
			</div>

			<div>
				<label for="ownerEmail" class="block text-sm font-medium text-foreground">
					Tu email de Google
				</label>
				<input
					type="email"
					id="ownerEmail"
					bind:value={ownerEmail}
					placeholder="tu@gmail.com"
					class="mt-1 block w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
					required
				/>
				<p class="mt-1 text-xs text-muted-foreground">
					Usa el mismo email con el que te autenticarás en Google
				</p>
			</div>

			{#if error}
				<div class="rounded-lg bg-destructive/10 border border-destructive/50 p-3 text-sm text-destructive">
					{error}
				</div>
			{/if}

			<button
				type="submit"
				disabled={submitting}
				class="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
			>
				{submitting ? 'Creando...' : 'Crear y continuar con Google'}
			</button>
		</form>

		<div class="text-center">
			<a
				href="/login"
				class="text-sm text-muted-foreground hover:text-foreground"
			>
				Volver al inicio de sesión
			</a>
		</div>
	</div>
</div>
