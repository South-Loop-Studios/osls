import { describe, it, expect } from "vitest";
import { WebSocket } from "ws";
import { Session } from "../session";
import { startViewer } from "../view/server";

// Attach the message collector BEFORE the socket opens. The server sends the
// connect snapshot the instant it accepts the upgrade, which can arrive in the
// same tick as "open" — a late `ws.once("message")` (attached after awaiting
// "open") races with and drops it. A persistent buffer can't miss a frame.
// (The production viewer client sets ws.onmessage synchronously at construction,
// so it has no such race.)
function messages(ws: WebSocket) {
  const queue: any[] = [];
  const waiters: Array<(m: any) => void> = [];
  ws.on("message", (d) => {
    const m = JSON.parse(d.toString());
    const w = waiters.shift();
    if (w) w(m);
    else queue.push(m);
  });
  return () =>
    new Promise<any>((resolve) => {
      const m = queue.shift();
      if (m !== undefined) resolve(m);
      else waiters.push(resolve);
    });
}

describe("startViewer", () => {
  it("pushes a snapshot on connect and broadcasts on change", async () => {
    const s = new Session();
    s.newLayout({ id: "t", name: "T" });
    const v = await startViewer(s, { port: 0 });
    try {
      const port = new URL(v.url).port;
      const ws = new WebSocket(`ws://127.0.0.1:${port}/live`);
      const nextMsg = messages(ws);
      await new Promise((r) => ws.once("open", r));

      const first = await nextMsg();
      expect(first.type).toBe("layout");
      expect(first.layout.speakers).toHaveLength(0);

      const next = nextMsg();
      s.addSpeaker({ label: "L", sp: "M+030" });
      const msg = await next;
      expect(msg.layout.speakers.map((x: any) => x.id)).toEqual(["L"]);

      ws.close();
    } finally {
      await v.close();
    }
  });

  it("binds to 127.0.0.1 only", async () => {
    const v = await startViewer(new Session(), { port: 0 });
    expect(v.url.startsWith("http://127.0.0.1:")).toBe(true);
    await v.close();
  });
});
