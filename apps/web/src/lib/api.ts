import { treaty } from '@elysiajs/eden'
import type { App } from '../../../api/src/index'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Eden Treaty client - fully typed REST API client
export const api = treaty<App>(API_URL, {
  fetch: {
    credentials: 'include',
  },
  headers: {
    'Content-Type': 'application/json',
  },
  onRequest(path, options) {
    console.log('[EDEN] Request to', path, options);
    return options;
  },
})

// Alias for backwards compatibility
export const rpc = api

// Legacy helpers for auth flows (redirect-based)
export async function getSession() {
  const res = await fetch(`${API_URL}/auth/session`, { credentials: 'include' })
  if (!res.ok) return null
  const data = await res.json()
  return data.session?.user || null
}

export async function logout() {
  await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' })
  localStorage.removeItem('tenant_id')
}

export function signInWithGoogle() {
  window.location.href = `${API_URL}/auth/google`
}

export async function uploadPhoto(
  file: File,
  options: { type: 'master' | 'tenant'; tenantId?: number; userId: number }
): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('type', options.type)
  formData.append('userId', options.userId.toString())
  if (options.tenantId) {
    formData.append('tenantId', options.tenantId.toString())
  }

  const res = await fetch(`${API_URL}/upload/photo`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to upload photo')
  }

  const data = await res.json()
  return data.url
}

export { API_URL }
