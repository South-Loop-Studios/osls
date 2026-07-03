import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { ReferenceCube } from "./ReferenceCube";
import { Listener } from "./Listener";
import { SpeakerNode } from "./SpeakerNode";
import { layoutToNodes } from "../sceneModel";
import type { LayoutData } from "../types";

export function Scene({ layout }: { layout: LayoutData | null }) {
  const nodes = layoutToNodes(layout);
  return (
    <Canvas camera={{ position: [2.4, 1.7, 3.0], fov: 45 }} gl={{ antialias: true }} dpr={[1, 2]}>
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 5, 2]} intensity={1.1} />
      <directionalLight position={[-3, 2, -2]} intensity={0.35} />
      <ReferenceCube />
      <Listener />
      {nodes.map((n) => (
        <SpeakerNode key={n.id} node={n} />
      ))}
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} minDistance={1.6} maxDistance={9} enablePan={false} />
    </Canvas>
  );
}
