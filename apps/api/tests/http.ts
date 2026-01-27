export const makeJsonRequest = (
  path: string,
  token?: string,
  method = 'GET',
  body?: unknown
) => {
  const headers: Record<string, string> = {}
  if (token) headers.cookie = `auth_token=${token}`
  if (body !== undefined) headers['content-type'] = 'application/json'

  return new Request(`http://localhost${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export const readJson = async <T>(response: Response): Promise<T> => {
  return response.json() as Promise<T>
}
