import { Html } from "@react-three/drei";
import type { SceneNode } from "../sceneModel";

export function SpeakerNode({ node }: { node: SceneNode }) {
  const isBox = node.kind === "box";
  return (
    <group position={node.position}>
      <mesh>
        {isBox ? <boxGeometry args={[0.08, 0.08, 0.08]} /> : <sphereGeometry args={[0.05, 24, 24]} />}
        <meshStandardMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={0.15}
          roughness={0.4}
          metalness={0.1}
          transparent={isBox}
          opacity={isBox ? 0.7 : 1}
        />
      </mesh>
      <Html position={[0, 0.13, 0]} center distanceFactor={9} zIndexRange={[20, 0]}>
        <span
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 11,
            lineHeight: 1,
            padding: "2px 6px",
            borderRadius: 4,
            whiteSpace: "nowrap",
            background: "rgba(22,24,29,0.7)",
            color: "#E6E8EC",
            border: "1px solid #2a2e37",
            backdropFilter: "blur(2px)",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {node.label}
        </span>
      </Html>
    </group>
  );
}
