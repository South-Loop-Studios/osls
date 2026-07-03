import { Scene } from "./scene/Scene";
import { useLiveLayout } from "./useLiveLayout";

export function App() {
  const { layout, state } = useLiveLayout();
  const count = layout?.speakers.length ?? 0;
  const mono = "ui-monospace, monospace";
  return (
    <div style={{ position: "fixed", inset: 0, background: "#16181D", color: "#E6E8EC" }}>
      <Scene layout={layout} />
      <div style={{ position: "fixed", top: 12, left: 14, fontFamily: mono, fontSize: 12, opacity: 0.85 }}>
        <strong style={{ color: "#3F73FF" }}>OSLS</strong> live · {layout?.name ?? "—"} · {count} speaker{count === 1 ? "" : "s"}
      </div>
      <div style={{ position: "fixed", top: 12, right: 14, fontFamily: mono, fontSize: 11 }}>
        <span style={{ color: state === "open" ? "#3F73FF" : "#6b7280" }}>● {state}</span>
      </div>
      {count === 0 && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", fontFamily: mono, fontSize: 13, color: "#9AA0AB" }}>
          Waiting for the AI to add speakers…
        </div>
      )}
    </div>
  );
}
