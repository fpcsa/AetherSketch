export const healthResponse = {
  status: 'ok',
  service: 'aethersketch',
} as const;

const worker = {
  fetch(request: Request): Response {
    const { pathname } = new URL(request.url);
    const headers = {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    };

    if (pathname === '/api/health') {
      if (request.method === 'HEAD') return new Response(null, { headers });
      if (request.method === 'GET')
        return Response.json(healthResponse, { headers });
      return Response.json(
        {
          error: {
            code: 'METHOD_NOT_ALLOWED',
            message: 'Use GET or HEAD for service health.',
          },
        },
        { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } },
      );
    }

    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return Response.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'API route not found.',
          },
        },
        { status: 404, headers },
      );
    }

    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler;

export default worker;
