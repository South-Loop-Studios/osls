import { useMemo } from "react";
import { Grid } from "@react-three/drei";
import { BoxGeometry, EdgesGeometry } from "three";

// Unit cube (ADM reference) + floor grid at the bottom face (z = -1).
export function ReferenceCube() {
  const edges = useMemo(() => new EdgesGeometry(new BoxGeometry(2, 2, 2)), []);
  return (
    <group>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#4a5160" transparent opacity={0.45} />
      </lineSegments>
      <Grid
        args={[2, 2]}
        position={[0, -1, 0]}
        cellSize={0.25}
        cellThickness={0.5}
        cellColor="#3a3f4a"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#4a5160"
        fadeDistance={14}
        fadeStrength={1.5}
        infiniteGrid={false}
      />
    </group>
  );
}
