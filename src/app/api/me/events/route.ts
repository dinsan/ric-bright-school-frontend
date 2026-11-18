import type { NextRequest } from "next/server";
import type { LiveEvent } from "@/features/messages/contract";
import { requireAuth } from "@/server/auth/context";
import { realtimeHub } from "@/server/realtime/hub";
import { route } from "@/server/http/route";

export const dynamic = "force-dynamic";

/** A stream lasts this long; the browser then reconnects, which checks the session again. */
const STREAM_MS = 10 * 60 * 1000;
const PING_MS = 25 * 1000;

/**
 * Live updates for parents and teachers (FE-COM-02), as Server-Sent Events: `ready` once listening, then
 * `message`, `read` and `announcement` events naming what changed (never the content), and a comment every
 * 25 s so proxies keep the connection open. See src/server/realtime/hub.ts.
 */
export const GET = route(async (request: NextRequest) => {
  const auth = await requireAuth(request, ["parent", "teacher"]);
  const hub = realtimeHub();
  await hub.ready(); // an unreachable database answers 503 here (route wrapper), and the browser polls instead
  const encoder = new TextEncoder();
  let stop = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;
      const send = (text: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          stop();
        }
      };
      const unsubscribe = hub.subscribe(auth.user.id, (event: LiveEvent) => send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
      const ping = setInterval(() => send(": ping\n\n"), PING_MS);
      const end = setTimeout(() => stop(), STREAM_MS);
      stop = () => {
        if (!open) return;
        open = false;
        clearInterval(ping);
        clearTimeout(end);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      request.signal.addEventListener("abort", () => stop());
      send("retry: 5000\n\n");
      send("event: ready\ndata: {}\n\n");
    },
    cancel() {
      stop();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
    },
  });
});
