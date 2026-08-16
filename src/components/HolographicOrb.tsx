import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbState, UserTrackingData, HandTrackingData } from "../types/zoya";

interface HolographicOrbProps {
  orbState: OrbState;
  userTracking: UserTrackingData;
  handTracking: HandTrackingData;
  audioLevel: number; // 0.0 to 1.0 for voice reactivity
}

export const HolographicOrb: React.FC<HolographicOrbProps> = ({
  orbState,
  userTracking,
  handTracking,
  audioLevel,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Mesh & particle references for animation loop
  const coreMeshRef = useRef<THREE.Mesh | null>(null);
  const outerWireRef = useRef<THREE.Mesh | null>(null);
  const ring1Ref = useRef<THREE.Mesh | null>(null);
  const ring2Ref = useRef<THREE.Mesh | null>(null);
  const ring3Ref = useRef<THREE.Mesh | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const glowSpriteRef = useRef<THREE.Sprite | null>(null);

  // Store state in ref for animation frame access
  const stateRef = useRef({ orbState, userTracking, handTracking, audioLevel });
  useEffect(() => {
    stateRef.current = { orbState, userTracking, handTracking, audioLevel };
  }, [orbState, userTracking, handTracking, audioLevel]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.z = 8;
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xff0044, 2, 20);
    pointLight.position.set(0, 0, 5);
    scene.add(pointLight);

    const secondaryLight = new THREE.PointLight(0x00f0ff, 1.5, 20);
    secondaryLight.position.set(-4, 3, 2);
    scene.add(secondaryLight);

    // 5. Orb Geometries & Materials

    // A. Inner Glowing Core
    const coreGeo = new THREE.IcosahedronGeometry(1.3, 3);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00a2ff,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.8,
      wireframe: false,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreMesh);
    coreMeshRef.current = coreMesh;

    // B. Outer Holographic Geodesic Wireframe
    const outerGeo = new THREE.IcosahedronGeometry(1.85, 2);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const outerWire = new THREE.Mesh(outerGeo, outerMat);
    scene.add(outerWire);
    outerWireRef.current = outerWire;

    // C. Energy Rings (Ultron Concentric Rings)
    const ring1Geo = new THREE.TorusGeometry(2.3, 0.03, 16, 100);
    const ring1Mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.x = Math.PI / 3;
    scene.add(ring1);
    ring1Ref.current = ring1;

    const ring2Geo = new THREE.TorusGeometry(2.6, 0.02, 16, 100);
    const ring2Mat = new THREE.MeshBasicMaterial({ color: 0xff0055, transparent: true, opacity: 0.7 });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.y = Math.PI / 4;
    scene.add(ring2);
    ring2Ref.current = ring2;

    const ring3Geo = new THREE.TorusGeometry(3.0, 0.015, 16, 100);
    const ring3Mat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.5 });
    const ring3 = new THREE.Mesh(ring3Geo, ring3Mat);
    ring3.rotation.z = Math.PI / 6;
    scene.add(ring3);
    ring3Ref.current = ring3;

    // D. Particle Cloud (1500 Floating Holographic Particles)
    const particleCount = 1400;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const originalPositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 2.2 + Math.random() * 2.5;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      particlePositions[i * 3] = x;
      particlePositions[i * 3 + 1] = y;
      particlePositions[i * 3 + 2] = z;

      originalPositions[i * 3] = x;
      originalPositions[i * 3 + 1] = y;
      originalPositions[i * 3 + 2] = z;
    }

    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));

    const particleTexture = createGlowTexture();
    const particleMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.12,
      transparent: true,
      opacity: 0.85,
      map: particleTexture,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);
    particlesRef.current = particles;

    // E. Background Halo Glow Sprite
    const spriteMat = new THREE.SpriteMaterial({
      map: particleTexture,
      color: 0x0088ff,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
    });
    const glowSprite = new THREE.Sprite(spriteMat);
    glowSprite.scale.set(6.5, 6.5, 1);
    scene.add(glowSprite);
    glowSpriteRef.current = glowSprite;

    // Handle Resize
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // 6. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();
      const { orbState: currentOrbState, userTracking: userTrack, handTracking: handTrack, audioLevel: currentAudio } = stateRef.current;

      // Color Schemes per OrbState
      let primaryColor = new THREE.Color(0x00f0ff);
      let secondaryColor = new THREE.Color(0xff0055);
      let coreEmissive = new THREE.Color(0x00a2ff);
      let rotSpeedMultiplier = 1.0;
      let particlePulse = 1.0;

      switch (currentOrbState) {
        case "listening":
          primaryColor.setHex(0x0088ff);
          secondaryColor.setHex(0x00ffea);
          coreEmissive.setHex(0x00d4ff);
          rotSpeedMultiplier = 1.5;
          particlePulse = 1.2 + currentAudio * 0.8;
          break;
        case "thinking":
          primaryColor.setHex(0xaa00ff);
          secondaryColor.setHex(0xff00ea);
          coreEmissive.setHex(0xd000ff);
          rotSpeedMultiplier = 3.2;
          particlePulse = 1.4;
          break;
        case "speaking":
          primaryColor.setHex(0xff0033);
          secondaryColor.setHex(0xff5500);
          coreEmissive.setHex(0xff1100);
          rotSpeedMultiplier = 2.0;
          particlePulse = 1.1 + currentAudio * 1.5;
          break;
        case "alert":
          primaryColor.setHex(0xff0000);
          secondaryColor.setHex(0xff3333);
          coreEmissive.setHex(0xff0022);
          rotSpeedMultiplier = 4.0;
          particlePulse = 1.6 + Math.sin(elapsedTime * 15) * 0.3;
          break;
        case "vision":
          primaryColor.setHex(0x00ffaa);
          secondaryColor.setHex(0x00e1ff);
          coreEmissive.setHex(0x00ffa2);
          rotSpeedMultiplier = 2.2;
          particlePulse = 1.3;
          break;
        case "idle":
        default:
          primaryColor.setHex(0x00f0ff);
          secondaryColor.setHex(0xff0055);
          coreEmissive.setHex(0x0077ff);
          rotSpeedMultiplier = 0.8;
          particlePulse = 1.0 + Math.sin(elapsedTime * 2) * 0.08;
          break;
      }

      // Smooth color transitions
      if (coreMeshRef.current) {
        (coreMeshRef.current.material as THREE.MeshStandardMaterial).color.lerp(primaryColor, 0.05);
        (coreMeshRef.current.material as THREE.MeshStandardMaterial).emissive.lerp(coreEmissive, 0.05);
      }
      if (outerWireRef.current) {
        (outerWireRef.current.material as THREE.MeshBasicMaterial).color.lerp(primaryColor, 0.05);
      }
      if (ring1Ref.current) {
        (ring1Ref.current.material as THREE.MeshBasicMaterial).color.lerp(primaryColor, 0.05);
      }
      if (ring2Ref.current) {
        (ring2Ref.current.material as THREE.MeshBasicMaterial).color.lerp(secondaryColor, 0.05);
      }
      if (particlesRef.current) {
        (particlesRef.current.material as THREE.PointsMaterial).color.lerp(primaryColor, 0.05);
      }
      if (glowSpriteRef.current) {
        (glowSpriteRef.current.material as THREE.SpriteMaterial).color.lerp(primaryColor, 0.05);
      }

      // Rotating Geometries
      if (coreMesh) {
        coreMesh.rotation.y += 0.005 * rotSpeedMultiplier;
        coreMesh.rotation.x += 0.003 * rotSpeedMultiplier;
        const scale = 1.0 + Math.sin(elapsedTime * 3) * 0.05 + currentAudio * 0.3;
        coreMesh.scale.set(scale, scale, scale);
      }

      if (outerWire) {
        outerWire.rotation.y -= 0.008 * rotSpeedMultiplier;
        outerWire.rotation.z += 0.004 * rotSpeedMultiplier;
      }

      if (ring1) {
        ring1.rotation.z += 0.015 * rotSpeedMultiplier;
        ring1.rotation.x += 0.005;
      }
      if (ring2) {
        ring2.rotation.y += 0.018 * rotSpeedMultiplier;
        ring2.rotation.z -= 0.01;
      }
      if (ring3) {
        ring3.rotation.x -= 0.02 * rotSpeedMultiplier;
        ring3.rotation.y += 0.008;
      }

      // Follow User & Hand Movements (Interactive Orbit Target)
      let targetX = 0;
      let targetY = 0;
      let targetZ = 0;

      if (userTrack.present) {
        // Face tracking position offset
        targetX = userTrack.x * 1.8;
        targetY = -userTrack.y * 1.2;
      }

      if (handTrack.detected) {
        // Hand tracking overrides / enhances position and scale
        targetX = handTrack.x * 2.5;
        targetY = -handTrack.y * 2.0;

        if (handTrack.gesture === "pinch") {
          // Pinch gesture scales orb depth
          targetZ = (handTrack.depthZ - 1.0) * 2.0;
        }
      }

      // Smooth interpolation towards target position
      scene.position.x += (targetX - scene.position.x) * 0.08;
      scene.position.y += (targetY - scene.position.y) * 0.08;
      scene.position.z += (targetZ - scene.position.z) * 0.08;

      // Particle Motion Loop
      if (particlesRef.current) {
        const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          const idx = i * 3;
          const origX = originalPositions[idx];
          const origY = originalPositions[idx + 1];
          const origZ = originalPositions[idx + 2];

          // Swirl effect
          const angle = elapsedTime * 0.5 + i * 0.01;
          const currentR = Math.sqrt(origX * origX + origY * origY + origZ * origZ) * particlePulse;

          positions[idx] = origX * particlePulse + Math.sin(angle) * 0.15;
          positions[idx + 1] = origY * particlePulse + Math.cos(angle) * 0.15;
          positions[idx + 2] = origZ * particlePulse + Math.sin(elapsedTime + i) * 0.1;
        }
        particlesRef.current.geometry.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
      <div ref={mountRef} className="w-full h-full absolute inset-0" />
    </div>
  );
};

// Helper: Generate a radial glow canvas texture for Three.js particles
function createGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.3, "rgba(0, 240, 255, 0.8)");
    gradient.addColorStop(0.7, "rgba(0, 100, 255, 0.2)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}
