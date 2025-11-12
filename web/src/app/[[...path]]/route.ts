import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UPSTREAM_ORIGIN = "https://talent-tensor.com";
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function filterHeaders(headers: Headers) {
  const result = new Headers();
  headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lowerKey)) {
      if (lowerKey === "set-cookie") {
        result.append(key, value);
      } else {
        result.set(key, value);
      }
    }
  });
  return result;
}

async function handleProxy(request: NextRequest) {
  const { pathname, search } = new URL(request.url);
  const targetUrl = new URL(pathname + search, UPSTREAM_ORIGIN);

  const headers = filterHeaders(request.headers);
  headers.set("host", targetUrl.host);
  headers.set("origin", targetUrl.origin);

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
    // Avoid Next.js caching for the proxy requests.
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    const body = await request.arrayBuffer();
    if (body.byteLength > 0) {
      init.body = body;
    }
  }

  const upstreamResponse = await fetch(targetUrl, init);

  const responseHeaders = filterHeaders(upstreamResponse.headers);
  responseHeaders.delete("content-encoding");

  const shouldIncludeBody =
    request.method !== "HEAD" &&
    upstreamResponse.status !== 204 &&
    upstreamResponse.status !== 304;

  if (shouldIncludeBody) {
    const arrayBuffer = await upstreamResponse.arrayBuffer();
    responseHeaders.set("content-length", String(arrayBuffer.byteLength));
    return new NextResponse(Buffer.from(arrayBuffer), {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  }

  return new NextResponse(null, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}

export const GET = handleProxy;
export const HEAD = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
export const OPTIONS = handleProxy;
