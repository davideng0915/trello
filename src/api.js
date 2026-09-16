const apiBase = '/api'

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${apiBase}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    })
  } catch (_error) {
    throw new Error('Backend is unavailable. Start the server with: cd server && npm run dev')
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || ''
    const body = contentType.includes('application/json')
      ? await response.json().catch(() => ({}))
      : {}
    throw new Error(body.error || `Request failed with status ${response.status}`)
  }

  if (response.status === 204) return null
  if (!(response.headers.get('content-type') || '').includes('application/json')) {
    throw new Error('Backend returned HTML instead of JSON. Make sure the backend is running on port 3001.')
  }
  return response.json()
}

export function fetchBoard() {
  return request('/board')
}

export function createColumn(title) {
  return request('/columns', {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
}

export function updateColumn(columnId, updates) {
  return request(`/columns/${columnId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

export function removeColumn(columnId) {
  return request(`/columns/${columnId}`, { method: 'DELETE' })
}

export function createTicket(columnId, title, details) {
  return request(`/columns/${columnId}/tickets`, {
    method: 'POST',
    body: JSON.stringify({ title, details }),
  })
}

export function updateTicket(ticketId, updates) {
  return request(`/tickets/${ticketId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

export function removeTicket(ticketId) {
  return request(`/tickets/${ticketId}`, { method: 'DELETE' })
}

export function createComment(ticketId, text) {
  return request(`/tickets/${ticketId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}
