interface Env {
  ASSETS: Fetcher
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // API: proxy sang backend Worker
    if (url.pathname.startsWith('/api/')) {
      const target = new URL(
        url.pathname + url.search,
        'https://itca-mangement-api.itca-nhaht.workers.dev'
      )

      const headers = new Headers(request.headers)
      headers.delete('host')

      return fetch(
        new Request(target.toString(), {
          method: request.method,
          headers,
          body:
            request.method === 'GET' || request.method === 'HEAD'
              ? undefined
              : request.body,
          redirect: 'manual'
        })
      )
    }

    // Các request còn lại: Vue SPA
    return env.ASSETS.fetch(request)
  }
}