import { useGLTF } from "@react-three/drei";
import { ThreeElements, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTF } from "three/examples/jsm/Addons.js";
import { consumeInteract } from "@/components/inputStore";
import { useSound } from "@/components/audio/useSound";

function useBasementDoor(scene: THREE.Group | undefined) {
  const { sound } = useSound();
  const { camera } = useThree();
  // Track both doors
  const _doorStartRef = useRef<THREE.Object3D | null>(null);
  const _doorEndRef = useRef<THREE.Object3D | null>(null);
  // Opening animation/state for DoorStart only
  const openingRef = useRef(false);
  const openedRef = useRef(false);
  const targetYRef = useRef(0);
  const initialYRef = useRef(0);

  // Locate the door in the loaded scene graph
  useEffect(() => {
    if (!scene) return;

    const doorFrameCutter = scene.getObjectByName("DoorStartCutter") as
      | THREE.Object3D
      | undefined;

    if (doorFrameCutter) {
      doorFrameCutter.visible = false;
    }

    const doorFrameCutterEnd = scene.getObjectByName("DoorCutterEnd") as
      | THREE.Object3D
      | undefined;
    if (doorFrameCutterEnd) {
      doorFrameCutterEnd.visible = false;
    }

    const doorStart = scene.getObjectByName("DoorStart") as
      | THREE.Object3D
      | undefined;
    const doorEnd = scene.getObjectByName("DoorEnd") as
      | THREE.Object3D
      | undefined;
    if (doorStart) {
      _doorStartRef.current = doorStart;
      initialYRef.current = doorStart.rotation.y;
    }
    if (doorEnd) {
      _doorEndRef.current = doorEnd;
    }
  }, [scene]);

  // Interaction is now unified via inputStore (pressInteract & consumeInteract)

  // Poll mobile interact flag each frame; also advance opening animation
  useFrame((_, delta) => {
    if (consumeInteract()) {
      // Prioritize DoorEnd teleport logic if near
      if (!tryDoorEndTeleport()) {
        console.log("Trying to open DoorStart");
        // otherwise try to open DoorStart if near
        tryOpenStart(true);
      }
    }
    // Animate door opening
    const door = _doorStartRef.current;
    if (!door) return;
    if (openingRef.current) {
      const speed = 1.2; // radians per second
      const y = door.rotation.y;
      const target = targetYRef.current;
      const step = Math.sign(target - y) * speed * delta;
      let next = y + step;
      // clamp overshoot
      if ((step > 0 && next >= target) || (step < 0 && next <= target)) {
        next = target;
        console.log("Door animation complete");
        openingRef.current = false;
        openedRef.current = !openedRef.current;
      }
      door.rotation.y = next;
    }
  });

  function tryOpenStart(withScriptedMove: boolean) {
    const door = _doorStartRef.current;
    if (!door) {
      console.warn("DoorStart not found or already opened");
      return;
    };
    // Check proximity to camera
    const doorPos = new THREE.Vector3();
    door.getWorldPosition(doorPos);
    const dist = doorPos.distanceTo(camera.position);
    const threshold = 1.0; // meters
    if (dist <= threshold) {
      openStartDoor(withScriptedMove);
    }
  }

  function openStartDoor(withScriptedMove: boolean) {
    const door = _doorStartRef.current;
    if (!door) {
      console.warn("DoorStart not found");
      return;
    };
    // Rotate 90 degrees around Y to open (invert direction to correct opening side)
    targetYRef.current = initialYRef.current - Math.PI / 2;
    openingRef.current = true;
    // play open slice
    sound.playDoorOpen();
    if (withScriptedMove) {
      const doorPos = new THREE.Vector3();
      door.getWorldPosition(doorPos);
      const lookAt: [number, number, number] = [
        doorPos.x - 10,
        doorPos.y,
        doorPos.z,
      ];
      window.dispatchEvent(
        new CustomEvent("__scripted_move__", {
          detail: {
            durationSec: 2.2,
            distance: 2.4,
            lockLook: true,
            lookAt,
            lookSlerp: 2.5,
            moveDelaySec: 0.35,
          },
        })
      );
    }
    // close after a bit
    setTimeout(() => {
      closeDoor();
    }, 3200);
  }

  function tryDoorEndTeleport(): boolean {



    const doorEnd = _doorEndRef.current;


    const doorStart = _doorStartRef.current;
    if (!doorEnd || !doorStart) return false;
    // Check proximity to DoorEnd
    const endPos = new THREE.Vector3();
    doorEnd.getWorldPosition(endPos);
    const dist = endPos.distanceTo(camera.position);
    const threshold = 1.0; // meters
    if (dist > threshold) return false;

    
    // first walk towards door end (if not close enough yet)
    const doorPos = new THREE.Vector3();
    if (!doorEnd) return false;
    doorEnd.getWorldPosition(doorPos);
    const distToDoorEnd = doorPos.distanceTo(camera.position);
    const approachThreshold = 1;
    if (distToDoorEnd > approachThreshold) {
      console.log("Approaching DoorEnd before teleport");
      window.dispatchEvent(
        new CustomEvent("__scripted_move__", {
          detail: { durationSec: 1, distance: distToDoorEnd},
        })
      );
      setTimeout(() => {
        tryDoorEndTeleport();
      },1000);
    }


    // Map player's local XZ offset relative to DoorEnd onto DoorStart, preserving distance and side offset
    const endMatrix = new THREE.Matrix4().copy(doorEnd.matrixWorld);
    const invEndMatrix = new THREE.Matrix4().copy(endMatrix).invert();
    const startMatrix = new THREE.Matrix4().copy(doorStart.matrixWorld);

    const playerWorld = new THREE.Vector3().copy(camera.position);
    const playerLocalToEnd = playerWorld.clone().applyMatrix4(invEndMatrix);
    // Preserve only ground-plane offset; Y handled by keepY
    const localXZ = new THREE.Vector3(playerLocalToEnd.x, 0, playerLocalToEnd.z);
    const targetWorld = localXZ.clone().applyMatrix4(startMatrix);


    const distanceOfPlayerFromDoorEnd = Math.hypot(playerLocalToEnd.x, playerLocalToEnd.z);

    // Compute yaw so the player looks at DoorStart
    const startPos = new THREE.Vector3();
    doorStart.getWorldPosition(startPos);

    const startTeleportPos = new THREE.Vector3();
    doorStart.getWorldPosition(startTeleportPos);
    startTeleportPos.sub(new THREE.Vector3(distanceOfPlayerFromDoorEnd, 0, 0)); // adjust for door center

    const lookDir = new THREE.Vector3().subVectors(startPos, startTeleportPos);
    lookDir.y = 0;
    lookDir.normalize();
    const yaw = Math.atan2(lookDir.x, lookDir.z);

    // Teleport player (preserve current Y/height) and set yaw to face the door
    window.dispatchEvent(
      new CustomEvent("__teleport_to__", {
        detail: { x: targetWorld.x + 0.8, z: targetWorld.z, keepY: true, yaw: yaw  },
      })
    );

    // Open DoorStart (without forced forward move by default)
    openStartDoor(true);
    return true;
  }

  function closeDoor() {
    const door = _doorStartRef.current;
    if (!door) return;
    targetYRef.current = initialYRef.current;
    openingRef.current = true;
    openedRef.current = false;
    // play close slice
    sound.playDoorClose();
  }
}

export default function Basement(props: ThreeElements["group"]) {
  const url = "/optimized/basement.glb";

  const gltf = useGLTF(url, true);

  useBasementDoor(gltf.scene);

  return (
    <group {...props}>
      <primitive object={gltf.scene} />
    </group>
  );
}

useGLTF.preload("/optimized/basement.glb");
