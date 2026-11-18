"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { EVENTS_URL } from "./api";
import type { LiveEvent } from "./contract";
import { messageKeys } from "./keys";

/**
 * Live updates for parents and teachers (FE-COM-02): one EventSource per tab on /api/me/events. Each event
 * names what changed; the matching queries are refetched, so new messages and announcements appear within a
 * second. When the stream is down (no EventSource, a proxy that buffers, the server restarting), `live` is
 * false and the message queries poll instead; when it comes back, everything is refetched, so nothing is
 * missed while it was away.
 */

const LiveContext = createContext(false);

/** True while the live stream is connected: queries can stop polling. */
export function useLive(): boolean {
  return useContext(LiveContext);
}

/** How often message queries poll while the live stream is down. */
export const POLL_MS = 20_000;

export function LiveUpdatesProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;
    const source = new EventSource(EVENTS_URL);
    const refresh = (event: LiveEvent) => {
      if (event.type === "message" || event.type === "read") {
        void queryClient.invalidateQueries({ queryKey: messageKeys.conversation(event.conversation_id) });
        void queryClient.invalidateQueries({ queryKey: messageKeys.conversations() });
      } else {
        void queryClient.invalidateQueries({ queryKey: messageKeys.announcements() });
      }
      void queryClient.invalidateQueries({ queryKey: messageKeys.unread() });
    };
    const listener = (message: MessageEvent<string>) => {
      try {
        refresh(JSON.parse(message.data) as LiveEvent);
      } catch {
        // not an event of ours
      }
    };
    source.addEventListener("ready", () => {
      setLive(true);
      // (Re)connected: anything may have happened while the stream was down.
      void queryClient.invalidateQueries({ queryKey: messageKeys.all });
    });
    for (const type of ["message", "read", "announcement"]) source.addEventListener(type, listener as EventListener);
    source.onerror = () => setLive(false); // EventSource reconnects by itself (the server asks for 5 s)
    return () => {
      source.close();
      setLive(false);
    };
  }, [enabled, queryClient]);

  return <LiveContext.Provider value={live}>{children}</LiveContext.Provider>;
}
