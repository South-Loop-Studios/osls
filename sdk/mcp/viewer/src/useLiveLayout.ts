import { useEffect, useState } from "react";
import type { LayoutData, LayoutMessage } from "./types";

export type ConnState = "connecting" | "open" | "closed";

// Connects to the MCP server's /live socket on the page's own host:port,
// replaces state on each full snapshot, and auto-reconnects if dropped.
export function useLiveLayout(): { layout: LayoutData | null; state: ConnState } {
  const [layout, setLayout] = useState<LayoutData | null>(null);
  const [state, setState] = useState<ConnState>("connecting");

  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: number | undefined;
    let disposed = false;

    const connect = () => {
      setState("connecting");
      ws = new WebSocket(`ws://${location.host}/live`);
      ws.onopen = () => setState("open");
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as LayoutMessage;
          if (msg.type === "layout") setLayout(msg.layout);
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        setState("closed");
        if (!disposed) timer = window.setTimeout(connect, 1000);
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      ws?.close();
    };
  }, []);

  return { layout, state };
}
