export async function onRequest(context: any) {
  const { request, params } = context

  const path = Array.isArray(params.path)
    ? params.path.join('/')
    : params.path

  const incomingUrl = new URL(request.url)

  const targetUrl = new URL(
    `/api/${path}${incomingUrl.search}`,
    'https://itca-mangement-api.itca-nhaht.workers.dev'
  )

  const headers = new Headers(request.headers)
  headers.delete('host')

  const proxyRequest = new Request(targetUrl.toString(), {
    method: request.method,
    headers,
    body:
      request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : request.body,
    redirect: 'manual'
  })

  return fetch(proxyRequest)
}