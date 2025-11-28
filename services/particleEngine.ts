
import * as THREE from 'three';
import { ParticleConfig, ShapeType, Point3D } from '../types';

const MAX_PARTICLES = 25000;

export class ParticleEngine {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  
  particles: THREE.Points;
  bgStars: THREE.Group;
  
  geometry: THREE.BufferGeometry;
  
  // Data arrays
  positions: Float32Array;
  targetPositions: Float32Array;
  colors: Float32Array;
  
  // Collision
  hashTable: Int32Array;
  nextEntry: Int32Array;
  hashSize = 16384; // 2^14 for bitwise masking

  // State
  currentConfig: ParticleConfig;
  customShapePoints: Point3D[] = [];
  
  // Rotation inertia
  scrollVelocity: number = 0;
  
  // Lifecycle
  isDisposed: boolean = false;

  constructor(container: HTMLElement, width: number, height: number) {
    // Prevent multiple canvases
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    this.scene = new THREE.Scene();
    // Disable fog for background visibility
    // this.scene.fog = new THREE.FogExp2(0x050505, 0.02); 

    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.z = 35;

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    // Initialize Particles
    this.currentConfig = {
      density: 0.5,
      spread: 0.5,
      color: '#00ffff',
      shape: ShapeType.NEBULA
    };

    this.initParticles();
    this.initBackground();

    // Add scroll event listener
    window.addEventListener('wheel', this.handleScroll, { passive: true });
  }

  handleScroll = (e: WheelEvent) => {
      if (this.isDisposed) return;
      const sensitivity = 0.0005;
      this.scrollVelocity += Math.abs(e.deltaY) * sensitivity;
      if (this.scrollVelocity > 0.3) {
          this.scrollVelocity = 0.3;
      }
  }

  initParticles() {
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.targetPositions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);

    // Initialize collision spatial hash arrays
    this.hashTable = new Int32Array(this.hashSize);
    this.nextEntry = new Int32Array(MAX_PARTICLES);

    const isMulticolor = this.currentConfig.color === 'MULTICOLOR';
    const singleColor = new THREE.Color(isMulticolor ? '#ffffff' : this.currentConfig.color);
    const tempColor = new THREE.Color();

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.positions[i * 3] = (Math.random() - 0.5) * 100;
      this.positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * 100;

      if (isMulticolor) {
          // Random HSL for multicolor
          tempColor.setHSL(Math.random(), 1.0, 0.6);
          this.colors[i * 3] = tempColor.r;
          this.colors[i * 3 + 1] = tempColor.g;
          this.colors[i * 3 + 2] = tempColor.b;
      } else {
          this.colors[i * 3] = singleColor.r;
          this.colors[i * 3 + 1] = singleColor.g;
          this.colors[i * 3 + 2] = singleColor.b;
      }
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const textureLoader = new THREE.TextureLoader();
    const sprite = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/sprites/spark1.png');

    const material = new THREE.PointsMaterial({
      size: 0.6,
      map: sprite,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.8
    });

    this.particles = new THREE.Points(this.geometry, material);
    this.scene.add(this.particles);

    this.updateTargetShape();
  }

  initBackground() {
    this.bgStars = new THREE.Group();

    // Create a procedural star texture (glowing dot)
    const getStarTexture = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
            grad.addColorStop(0, 'rgba(255, 255, 255, 1)'); // Core
            grad.addColorStop(0.1, 'rgba(255, 255, 255, 0.8)');
            grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.1)'); // Glow
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 32, 32);
        }
        return new THREE.CanvasTexture(canvas);
    };

    const starTexture = getStarTexture();

    // 1. Distant Stardust (Deep Background)
    // Large quantity, small, white, faint, strictly background
    const dustCount = 6000;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    
    // Galactic Plane Generation for Background
    // Create a band of stars to simulate the milky way view
    for (let i = 0; i < dustCount; i++) {
        const r = 400 + Math.random() * 800;
        
        // Distribution: 70% in a band, 30% spherical
        let theta, phi;
        if (Math.random() < 0.7) {
            // Band (Milky Wayish)
            theta = Math.random() * Math.PI * 2;
            // Phi close to PI/2 (equator) with some spread
            const spread = 0.4;
            phi = (Math.PI / 2) + (Math.random() - 0.5) * spread;
        } else {
            // Spherical scatter
            theta = Math.random() * Math.PI * 2;
            phi = Math.acos(2 * Math.random() - 1);
        }
        
        dustPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        dustPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        dustPos[i * 3 + 2] = r * Math.cos(phi);
    }
    
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 1.8,
        map: starTexture,
        transparent: true,
        opacity: 0.5, // Boosted visibility
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false // Crucial: ignore fog
    });
    this.bgStars.add(new THREE.Points(dustGeo, dustMat));

    // 2. Bright Stars (Foreground/Highlights)
    // Blue-white, Pale Yellow, distinct
    const starCount = 400;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starCol = new Float32Array(starCount * 3);
    
    // Star colors: Blue-white, White, Pale Yellow to simulate real star types
    const starColors = [
        new THREE.Color(0xaabfff), // Blue-white (O/B stars)
        new THREE.Color(0xffffff), // White
        new THREE.Color(0xffddaa), // Pale Yellow (G/K stars)
        new THREE.Color(0xfff4e8)  // Warm white
    ];

    for (let i = 0; i < starCount; i++) {
        const r = 200 + Math.random() * 600; 
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        starPos[i * 3 + 2] = r * Math.cos(phi);

        const color = starColors[Math.floor(Math.random() * starColors.length)];
        starCol[i * 3] = color.r;
        starCol[i * 3 + 1] = color.g;
        starCol[i * 3 + 2] = color.b;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
    
    const starMat = new THREE.PointsMaterial({
        size: 4.0, 
        map: starTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false // Crucial: ignore fog
    });
    this.bgStars.add(new THREE.Points(starGeo, starMat));

    this.scene.add(this.bgStars);
  }

  setCustomShape(points: Point3D[]) {
    this.customShapePoints = points;
    if (this.currentConfig.shape === ShapeType.CUSTOM) {
        this.updateTargetShape();
    }
  }

  updateTargetShape() {
    const { shape, density } = this.currentConfig;
    const count = Math.floor(MAX_PARTICLES * density);
    
    for (let i = 0; i < MAX_PARTICLES; i++) {
      let x = 0, y = 0, z = 0;

      if (i >= count) {
        x = 9999; y = 9999; z = 9999;
      } else {
        switch (shape) {
          case ShapeType.SPHERE:
            const r = 12 * Math.cbrt(Math.random());
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos(2 * Math.random() - 1);
            x = r * Math.sin(phi) * Math.cos(theta);
            y = r * Math.sin(phi) * Math.sin(theta);
            z = r * Math.cos(phi);
            break;

          case ShapeType.HEART:
            const t = Math.random() * Math.PI * 2;
            const scaleH = 0.9;
            const hx = 16 * Math.pow(Math.sin(t), 3);
            const hy = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
            const rVol = Math.random();
            x = hx * scaleH * rVol;
            y = hy * scaleH * rVol;
            z = (Math.random() - 0.5) * 10 * rVol;
            break;
        
          case ShapeType.GALAXY:
             const arms = 3;
             const spin = 3.5;
             const rGal = Math.pow(Math.random(), 0.7); // Bias towards center
             const radius = rGal * 22; // Max radius
             
             const armIndex = i % arms;
             const armAngle = (armIndex / arms) * Math.PI * 2;
             
             // Spiral equation: theta = a + b * r
             const angleBase = armAngle + rGal * spin;
             
             // Add noise to arms (width increases with radius)
             const spread = 0.3 + rGal * 0.8; 
             const angleRandom = (Math.random() - 0.5) * spread;
             
             const finalAngle = angleBase + angleRandom;

             x = Math.cos(finalAngle) * radius;
             y = Math.sin(finalAngle) * radius;
             // Thicker at center, thinner at edges
             z = (Math.random() - 0.5) * (6 * (1 - rGal * 0.7)); 
             break;

          case ShapeType.MOBIUS:
             // 3D Infinity Loop / Twisted Ribbon (Lemniscate Based)
             const uMob = Math.random() * Math.PI * 2;
             // Width of the ribbon
             const wMob = (Math.random() - 0.5) * 6; 
             const scale = 18; 
             const depthScale = 4;

             // 1. Center Line (Lemniscate with Z-wave for separation)
             // x = sin(u)
             // y = sin(u)cos(u) -> Figure 8
             // z = cos(u) -> Vertical separation
             const xc = scale * Math.sin(uMob);
             const yc = scale * Math.sin(uMob) * Math.cos(uMob);
             const zc = depthScale * Math.cos(uMob);

             // 2. Calculate Tangent Vector (Derivative)
             // dx = cos(u)
             // dy = cos(2u)
             // dz = -sin(u)
             const tx = scale * Math.cos(uMob);
             const ty = scale * Math.cos(2 * uMob);
             const tz = -depthScale * Math.sin(uMob);
             
             // Normalize Tangent
             const tLen = Math.sqrt(tx*tx + ty*ty + tz*tz);
             const ntx = tx / tLen;
             const nty = ty / tLen;
             const ntz = tz / tLen;

             // 3. Construct Normal Frame (Binormal up = Z, but we need robust frame)
             // Approximate Up vector (Z-axis) usually works since curve is mostly flat-ish
             // Normal = Up x Tangent
             let nx = -nty; 
             let ny = ntx;
             let nz = 0;
             // If tangent is vertical (rare here), fallback
             const nLen = Math.sqrt(nx*nx + ny*ny + nz*nz);
             nx /= nLen; ny /= nLen; nz /= nLen;

             // Binormal = Tangent x Normal
             const bx = nty * nz - ntz * ny;
             const by = ntz * nx - ntx * nz;
             const bz = ntx * ny - nty * nx;

             // 4. Apply Twist
             // Mobius twist: rotates 180 degrees (PI) over the full loop (2PI)
             const twistAngle = uMob / 2;
             const cosTwist = Math.cos(twistAngle);
             const sinTwist = Math.sin(twistAngle);

             // Offset vector = Normal * cos(twist) + Binormal * sin(twist)
             const offX = nx * cosTwist + bx * sinTwist;
             const offY = ny * cosTwist + by * sinTwist;
             const offZ = nz * cosTwist + bz * sinTwist;

             // 5. Final Position
             x = xc + wMob * offX;
             y = yc + wMob * offY;
             z = zc + wMob * offZ;
             
             // Add some thickness volume
             const thickness = (Math.random() - 0.5) * 1.5;
             // Add thickness along the "surface normal" (cross product of tangent and offset vector)
             // Or just simple noise
             x += (Math.random() - 0.5) * 0.5;
             y += (Math.random() - 0.5) * 0.5;
             z += (Math.random() - 0.5) * 0.5 + thickness;
             break;

          case ShapeType.CUSTOM:
             if (this.customShapePoints.length > 0) {
                 const p = this.customShapePoints[i % this.customShapePoints.length];
                 x = p.x + (Math.random() - 0.5);
                 y = p.y + (Math.random() - 0.5);
                 z = p.z + (Math.random() - 0.5);
             } else {
                 const rs = 5;
                 x = (Math.random() - 0.5) * rs;
                 y = (Math.random() - 0.5) * rs;
                 z = 0;
             }
             break;

          case ShapeType.NEBULA:
          default:
             const dist = Math.random();
             const angle = Math.random() * Math.PI * 2;
             const rad = (Math.random() < 0.5 ? Math.random() * 5 : Math.random() * 20);
             x = Math.cos(angle) * rad;
             y = Math.sin(angle) * rad;
             z = (Math.random() - 0.5) * 10;
             break;
        }
      }

      this.targetPositions[i * 3] = x;
      this.targetPositions[i * 3 + 1] = y;
      this.targetPositions[i * 3 + 2] = z;
    }
  }

  updateConfig(newConfig: Partial<ParticleConfig>) {
    if (this.isDisposed) return;

    this.currentConfig = { ...this.currentConfig, ...newConfig };

    if (newConfig.color) {
      const attr = this.geometry.attributes.color as THREE.BufferAttribute;
      
      if (newConfig.color === 'MULTICOLOR') {
          // Switch to multicolor mode: Assign random bright colors
          const tempColor = new THREE.Color();
          for(let i=0; i<MAX_PARTICLES; i++) {
            tempColor.setHSL(Math.random(), 1.0, 0.6); // High saturation
            attr.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
          }
      } else {
          // Switch to single color mode
          const c = new THREE.Color(newConfig.color);
          for(let i=0; i<MAX_PARTICLES; i++) {
            attr.setXYZ(i, c.r, c.g, c.b);
          }
      }
      attr.needsUpdate = true;
    }

    if (newConfig.shape !== undefined || newConfig.density !== undefined) {
      this.updateTargetShape();
    }
  }

  animate(handOpenness: number) {
    if (this.isDisposed) return;

    this.scrollVelocity *= 0.96;
    if (Math.abs(this.scrollVelocity) < 0.0001) this.scrollVelocity = 0;

    const baseRotationSpeed = 0.002;
    const currentSpeed = baseRotationSpeed + this.scrollVelocity;

    this.particles.rotation.y += currentSpeed;
    
    // Independent background rotation (slow drift)
    // Does not react to scroll velocity to keep depth perception stable
    this.bgStars.rotation.y -= 0.0003; 

    const positions = this.geometry.attributes.position.array as Float32Array;
    
    // Spatial Hashing
    this.hashTable.fill(-1);
    this.nextEntry.fill(-1);
    
    const cellSize = 1.2;
    const hashMask = this.hashSize - 1;

    for (let i = 0; i < MAX_PARTICLES; i++) {
        const idx = i * 3;
        if (positions[idx] > 8000) continue;

        const xi = Math.floor(positions[idx] / cellSize);
        const yi = Math.floor(positions[idx+1] / cellSize);
        const zi = Math.floor(positions[idx+2] / cellSize);

        const hash = ((xi * 73856093) ^ (yi * 19349663) ^ (zi * 83492791)) & hashMask;
        this.nextEntry[i] = this.hashTable[hash];
        this.hashTable[hash] = i;
    }
    
    const explosionFactor = handOpenness * 60 * this.currentConfig.spread; 
    const cohesionSpeed = 0.05 + (1 - handOpenness) * 0.1;
    const noiseAmt = handOpenness * 0.8;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const idx = i * 3;
      
      let tx = this.targetPositions[idx];
      let ty = this.targetPositions[idx+1];
      let tz = this.targetPositions[idx+2];

      if (tx > 9000) {
        positions[idx] = 9999;
        continue;
      }

      if (handOpenness > 0.1) {
          const dist = Math.sqrt(tx*tx + ty*ty + tz*tz) + 0.1;
          const dirX = tx / dist;
          const dirY = ty / dist;
          const dirZ = tz / dist;
          
          tx += dirX * explosionFactor;
          ty += dirY * explosionFactor;
          tz += dirZ * explosionFactor;

          tx += (Math.random() - 0.5) * noiseAmt;
          ty += (Math.random() - 0.5) * noiseAmt;
          tz += (Math.random() - 0.5) * noiseAmt;
      }

      positions[idx] += (tx - positions[idx]) * cohesionSpeed;
      positions[idx+1] += (ty - positions[idx+1]) * cohesionSpeed;
      positions[idx+2] += (tz - positions[idx+2]) * cohesionSpeed;

      const xi = Math.floor(positions[idx] / cellSize);
      const yi = Math.floor(positions[idx+1] / cellSize);
      const zi = Math.floor(positions[idx+2] / cellSize);
      const hash = ((xi * 73856093) ^ (yi * 19349663) ^ (zi * 83492791)) & hashMask;

      let neighbor = this.hashTable[hash];
      let checkCount = 0;
      const maxChecks = 10;

      while (neighbor !== -1 && checkCount < maxChecks) {
          if (neighbor !== i) {
              const nIdx = neighbor * 3;
              const dx = positions[idx] - positions[nIdx];
              const dy = positions[idx+1] - positions[nIdx+1];
              const dz = positions[idx+2] - positions[nIdx+2];
              const distSq = dx*dx + dy*dy + dz*dz;
              const minDist = 0.7;
              
              if (distSq < minDist * minDist && distSq > 0.00001) {
                  const dist = Math.sqrt(distSq);
                  const pushStrength = 0.15;
                  const force = (minDist - dist) / dist * pushStrength;
                  
                  positions[idx] += dx * force;
                  positions[idx+1] += dy * force;
                  positions[idx+2] += dz * force;
              }
          }
          neighbor = this.nextEntry[neighbor];
          checkCount++;
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }

  resize(width: number, height: number) {
    if (this.isDisposed) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
  
  dispose() {
      this.isDisposed = true;
      window.removeEventListener('wheel', this.handleScroll);
      
      this.scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(m => m.dispose());
                } else {
                    object.material.dispose();
                }
            }
        }
      });

      this.renderer.dispose();
      // Force loss of context
      this.renderer.forceContextLoss();
      
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
          this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
  }
}
