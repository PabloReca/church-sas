<script lang="ts">
	import { signInWithGoogle } from '@/lib/api';
	import { page } from '$app/stores';

	let errorMessage = $state('');

	$effect(() => {
		const error = $page.url.searchParams.get('error');
		if (error) {
			const errorMessages: Record<string, string> = {
				account_not_registered: 'Tu cuenta no está registrada. Contacta al administrador para obtener acceso.',
				account_not_found_or_inactive: 'Tu cuenta no está activa o no existe en este sistema.',
				no_code: 'Error en el proceso de autenticación. Inténtalo de nuevo.',
				token_exchange_failed: 'Error al intercambiar el código de autenticación.',
				invalid_token: 'Token de autenticación inválido.',
				auth_failed: 'Error al autenticar. Por favor, inténtalo de nuevo.'
			};
			errorMessage = errorMessages[error] || 'Error desconocido al iniciar sesión.';
		}
	});
</script>

<div class="flex min-h-screen items-center justify-center bg-background">
	<div class="w-full max-w-md space-y-8 rounded-lg bg-card p-8 border border-border">
		<div class="text-center">
			<h2 class="text-3xl font-bold tracking-tight text-foreground">Church</h2>
			<p class="mt-2 text-sm text-muted-foreground">Inicia sesión para acceder a tu organización</p>
		</div>

		{#if errorMessage}
			<div class="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
				<div class="flex">
					<div class="flex-shrink-0">
						<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
						</svg>
					</div>
					<div class="ml-3">
						<p class="text-sm font-medium text-red-800 dark:text-red-200">
							{errorMessage}
						</p>
					</div>
				</div>
			</div>
		{/if}

		<div class="mt-8 space-y-4">
			<button
				onclick={signInWithGoogle}
				class="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background focus:outline-none"
			>
				<svg class="h-5 w-5" viewBox="0 0 24 24">
					<path
						fill="#4285F4"
						d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
					/>
					<path
						fill="#34A853"
						d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
					/>
					<path
						fill="#FBBC05"
						d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
					/>
					<path
						fill="#EA4335"
						d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
					/>
				</svg>
				Iniciar sesión con Google
			</button>

			<div class="relative">
				<div class="absolute inset-0 flex items-center">
					<div class="w-full border-t border-border"></div>
				</div>
				<div class="relative flex justify-center text-xs uppercase">
					<span class="bg-card px-2 text-muted-foreground">o</span>
				</div>
			</div>

			<a
				href="/setup-tenant"
				class="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-primary bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background focus:outline-none"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
				Crear nueva organización
			</a>
		</div>
	</div>
</div>
