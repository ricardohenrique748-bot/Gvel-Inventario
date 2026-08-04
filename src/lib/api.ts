const configuredUrl = import.meta.env.VITE_API_URL as string | undefined

if (!configuredUrl) {
  console.warn(
    '[Gvel Diesel] VITE_API_URL não configurado. Preencha o arquivo .env (veja .env.example).',
  )
}

const BASE_URL = configuredUrl || 'http://localhost:4000/api'

const TOKEN_KEY = 'gvel_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export interface ApiResult<T> {
  data: T | null
  error: { message: string } | null
}

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  try {
    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
    const isJson = res.headers.get('content-type')?.includes('application/json')
    const body = isJson ? await res.json().catch(() => null) : null

    if (!res.ok) {
      return { data: null, error: { message: body?.error ?? res.statusText } }
    }
    return { data: (body as T) ?? null, error: null }
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : 'Erro de rede.' } }
  }
}

export function apiGet<T>(path: string) {
  return request<T>(path, { method: 'GET' })
}

export function apiPost<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
  })
}

export function apiPatch<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: 'PATCH',
    body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
  })
}

export function apiDelete<T>(path: string) {
  return request<T>(path, { method: 'DELETE' })
}
