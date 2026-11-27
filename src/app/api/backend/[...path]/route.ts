import type { NextRequest } from "next/server";

// Proxy para o backend. O navegador chama /api/backend/* (mesma origem, sem CORS)
// e AQUI, no servidor, adicionamos o Bearer lido do .env. O token nunca vai para o navegador.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

async function proxy(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const token = process.env.BACKEND_API_TOKEN;
  if (!token) {
    return Response.json(
      { error: "BACKEND_API_TOKEN não configurado. Defina no .env.local e reinicie o servidor." },
      { status: 500 },
    );
  }

  const { path } = await params;
  const url = `${BACKEND_URL}/${path.join("/")}${request.nextUrl.search}`;
  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  try {
    const res = await fetch(url, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(hasBody && { "Content-Type": "application/json" }),
      },
      body: hasBody ? await request.text() : undefined,
      cache: "no-store",
    });
    return new Response(res.body, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return Response.json({ error: `Não consegui falar com o backend em ${BACKEND_URL}.` }, { status: 502 });
  }
}

export { proxy as GET, proxy as POST };
