interface Env {
  ASSETS: Fetcher
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
if (url.pathname === '/api/proxy-test') {
  return new Response('FRONTEND WORKER PROXY OK', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' }
  })
}

if (url.pathname === '/api/health') {
  const target = 'https://itca-mangement-api.itca-nhaht.workers.dev/api/health'

  const response = await fetch(target)
  const body = await response.text()

  return Response.json({
    target,
    backendStatus: response.status,
    backendBody: body
  })
}

    // API: proxy sang backend Worker
    if (url.pathname.startsWith('/api/')) {
      const target = new URL(
        url.pathname + url.search,
        'https://itca-mangement-api.itca-nhaht.workers.dev'
      )


      const headers = new Headers(request.headers)
      headers.delete('host')

return fetch(target.toString(), {
  method: request.method,
  headers,
  body:
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.arrayBuffer(),
  redirect: 'manual'
})
    }

    // Các request còn lại: Vue SPA
    return env.ASSETS.fetch(request)
  }
}