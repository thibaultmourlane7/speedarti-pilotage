const BASE_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, accept, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

const UPSTREAM_BASE = "https://veovtygcolfsrjocrhsf.supabase.co/functions/v1/pilotage-mcp";
const PUBLIC_RESOURCE = "https://veovtygcolfsrjocrhsf.supabase.co/functions/v1/pilotage-mcp-v2";

function suffixFromIncoming(url: URL) {
  const marker = "/pilotage-mcp-v2";
  const i = url.pathname.indexOf(marker);
  if (i < 0) return "";
  return url.pathname.slice(i + marker.length) || "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: BASE_HEADERS });

  const incoming = new URL(req.url);
  const suffix = suffixFromIncoming(incoming);
  const target = new URL(UPSTREAM_BASE + suffix);

  incoming.searchParams.forEach((value, key) => target.searchParams.append(key, value));

  const headers = new Headers();
  for (const name of ["authorization","content-type","accept","mcp-protocol-version","mcp-session-id","user-agent"]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("x-pilotage-public-resource", PUBLIC_RESOURCE);
  if (req.method === "POST" && !headers.has("content-type")) headers.set("content-type", "application/json");

  let raw: string | undefined;
  let method = "";
  if (req.method === "POST") {
    raw = await req.text();
    try { method = JSON.parse(raw)?.method || ""; } catch {}
  }

  const upstream = await fetch(target.toString(), {
    method: req.method,
    headers,
    body: req.method === "POST" ? raw : undefined,
    redirect: "manual"
  });

  const textBody = await upstream.text();
  let out = textBody;

  // Compatibilité historique Claude : la V2 retire structuredContent sur les
  // appels d'outil et conserve le marqueur resultType attendu par ce client.
  if (req.method === "POST" && method === "tools/call" && upstream.ok) {
    try {
      const parsed = JSON.parse(textBody);
      if (parsed && parsed.result) {
        parsed.result.resultType = "complete";
        if (!Array.isArray(parsed.result.content)) parsed.result.content = [];
        delete parsed.result.structuredContent;
        out = JSON.stringify(parsed);
      }
    } catch {}
  }

  const responseHeaders = new Headers(BASE_HEADERS);
  for (const name of ["content-type","www-authenticate","location","cache-control","pragma","expires"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  const sid = upstream.headers.get("mcp-session-id");
  if (sid) responseHeaders.set("Mcp-Session-Id", sid);

  return new Response(out, { status: upstream.status, headers: responseHeaders });
});
