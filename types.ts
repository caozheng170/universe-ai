
export enum ShapeType {
  NEBULA = 'NEBULA',
  HEART = 'HEART',
  SPHERE = 'SPHERE',
  GALAXY = 'GALAXY',
  MOBIUS = 'MOBIUS',
  CUSTOM = 'CUSTOM'
}

export interface ParticleConfig {
  density: number; // 0.1 to 1.0 (multiplier of max particles)
  spread: number; // Dispersion factor
  color: string;
  shape: ShapeType;
}

export interface HandData {
  isOpen: boolean;
  openness: number; // 0 (closed/fist) to 1 (fully open)
  x: number; // Normalized screen X
  y: number; // Normalized screen Y
}

export type Point3D = { x: number; y: number; z: number };