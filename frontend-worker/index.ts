interface Env {
  API: Fetcher
  ASSETS: Fetcher
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // API: gọi trực tiếp backend Worker qua Service Binding
    if (url.pathname.startsWith('/api/')) {
      return env.API.fetch(request)
    }

    // Vue SPA / static assets
    return env.ASSETS.fetch(request)
  }
}