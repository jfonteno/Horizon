import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { IncomingMessage, RequestListener, Server, ServerResponse } from "node:http";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function requestPathname(request: IncomingMessage) {
  const rawPathname = (request.url || "/").split("?", 1)[0];
  try {
    return decodeURIComponent(rawPathname).replaceAll("\\", "/");
  } catch {
    return null;
  }
}

function resolveClientFile(clientDirectory: string, pathname: string) {
  if (pathname === "/" || pathname.startsWith("/.vite/") || pathname === "/.vite") return null;
  const clientRoot = resolve(clientDirectory);
  const candidate = resolve(clientRoot, `.${pathname}`);
  const childPath = relative(clientRoot, candidate);
  if (!childPath || childPath.startsWith(`..${sep}`) || childPath === ".." || isAbsolute(childPath)) return null;
  return candidate;
}

async function serveClientFile(
  request: IncomingMessage,
  response: ServerResponse,
  clientDirectory: string,
) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const pathname = requestPathname(request);
  if (!pathname) return false;
  const filename = resolveClientFile(clientDirectory, pathname);
  if (!filename) return false;

  let file;
  try {
    file = await stat(filename);
  } catch {
    return false;
  }
  if (!file.isFile()) return false;

  const extension = extname(filename).toLowerCase();
  const immutable = pathname.startsWith("/assets/");
  const etag = `W/\"${file.size}-${Math.floor(file.mtimeMs / 1000)}\"`;
  const headers = {
    "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=3600",
    "Content-Length": String(file.size),
    "Content-Type": CONTENT_TYPES[extension] || "application/octet-stream",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  };

  if (request.headers["if-none-match"] === etag) {
    response.writeHead(304, {
      "Cache-Control": headers["Cache-Control"],
      ETag: etag,
    });
    response.end();
    return true;
  }

  response.writeHead(200, headers);
  if (request.method === "HEAD") {
    response.end();
    return true;
  }

  createReadStream(filename).on("error", (error) => response.destroy(error)).pipe(response);
  return true;
}

function runDownstream(
  server: Server,
  listeners: RequestListener[],
  request: IncomingMessage,
  response: ServerResponse,
) {
  for (const listener of listeners) listener.call(server, request, response);
}

export function installWindowsStaticAssetCompatibility(
  server: Server,
  clientDirectory: string,
  force = process.platform === "win32",
) {
  if (!force) return false;
  const listeners = server.listeners("request") as RequestListener[];
  if (!listeners.length) throw new Error("Horizon could not locate the production request handler.");

  server.removeAllListeners("request");
  server.on("request", (request, response) => {
    void serveClientFile(request, response, clientDirectory)
      .then((served) => {
        if (!served) runDownstream(server, listeners, request, response);
      })
      .catch((error) => {
        console.warn("[horizon] Windows static asset compatibility failed:", error);
        if (!response.headersSent) runDownstream(server, listeners, request, response);
        else response.destroy(error instanceof Error ? error : undefined);
      });
  });
  return true;
}

