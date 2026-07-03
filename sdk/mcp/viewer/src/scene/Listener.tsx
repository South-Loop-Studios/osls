import { Html } from "@react-three/drei";
import { admToThreeTuple } from "../lib/coords";

const CUES: Array<{ label: string; at: { x: number; y: number; z: number } }> = [
  { label: "FRONT", at: { x: 0, y: 1.18, z: 0 } },
  { label: "BACK", at: { x: 0, y: -1.18, z: 0 } },
  { label: "L", at: { x: -1.18, y: 0, z: 0 } },
  { label: "R", at: { x: 1.18, y: 0, z: 0 } },
  { label: "TOP", at: { x: 0, y: 0, z: 1.18 } },
];

export function Listener() {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.045, 20, 20]} />
        <meshStandardMaterial color="#E6E8EC" emissive="#E6E8EC" emissiveIntensity={0.18} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, -0.07]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.025, 0.06, 16]} />
        <meshStandardMaterial color="#9AA0AB" />
      </mesh>
      {CUES.map((c) => (
        <Html key={c.label} position={admToThreeTuple(c.at)} center distanceFactor={11} zIndexRange={[20, 0]}>
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, letterSpacing: 2, color: "#6b7280", pointerEvents: "none", userSelect: "none" }}>
            {c.label}
          </span>
        </Html>
      ))}
    </group>
  );
}
