export const healthResponse = {
  status: 'ok',
  service: 'aethersketch',
} as const;

const worker = {
  fetch(request: Request): Response {
    const { pathname } = new URL(request.url);

    if (request.method === 'GET' && pathname === '/api/health') {
      return Response.json(healthResponse, {
        headers: {
          'Cache-Control': 'no-store',
        },
      });
    }

    if (pathname.startsWith('/api/')) {
      return Response.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'API route not found.',
          },
        },
        { status: 404 },
      );
    }

    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler;

export default worker;
