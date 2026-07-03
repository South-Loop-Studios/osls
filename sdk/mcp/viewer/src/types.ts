// Minimal mirror of the @orbitspatial/osls-core wire shape the viewer reads. The viewer is a
// standalone read-only client; it only consumes plain JSON over the WebSocket.
export interface Vec3 { x: number; y: number; z: number; }
export interface Polar { az: number; el: number; dist: number; }

export interface Speaker {
  id: string;
  label: string;
  sp: string;
  isLFE: boolean;
  cartesian: Vec3;
  polar?: Polar;
  aliases?: string[];
}

export interface LayoutData {
  id: string;
  name: string;
  speakers: Speaker[];
  orderings?: Record<string, string[]>;
}

export interface LayoutMessage { type: "layout"; layout: LayoutData; }
