// src/components/KinematicMeshCollider.jsx

import {
  RigidBody,
  CuboidCollider,
  RapierRigidBody,
} from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Props for the KinematicMeshCollider
 */
type Props = {
  /** The parent scene (e.g., gltf.scene) to search within */
  scene: THREE.Group;
  /** The name of the mesh to find and track */
  name: string;
};

// Re-usable vectors to avoid creating new ones in the render loop
const worldPos = new THREE.Vector3();
const worldQuat = new THREE.Quaternion();

/**
 * A reusable component that finds a mesh by name in a scene
 * and creates a kinematic collider that follows its animation.
 */
export function KinematicMeshCollider({ scene, name }: Props) {
  const rigidBodyRef = useRef<RapierRigidBody>(null);

  // Find the mesh in the scene graph
  const mesh = useMemo(() => {
    if (!scene) return null;
    const object = scene.getObjectByName(name);

    // find the mesh in the object
    let foundMesh: THREE.Mesh | null = null;

    if (object) {
      if (object.isMesh) {
        // Case 1: The object itself is the mesh
        foundMesh = object as THREE.Mesh;
      } else {
        // Case 2: The object is a group, find the first mesh inside
        object.traverse((child) => {
          if (child.isMesh && !foundMesh) {
            foundMesh = child as THREE.Mesh;
          }
        });
      }
    }

    if (!foundMesh) {
      console.warn(
        `KinematicMeshCollider: Could not find object named "${name}" or it contains no mesh.`
      );
      return null;
    }
    if (!foundMesh.isMesh) {
      // This check is slightly redundant given our logic, but harmless
      console.warn(
        `KinematicMeshCollider: Object "${name}" is not a THREE.Mesh`
      );
      return null;
    }
    return foundMesh;
  }, [scene, name]);

  // Calculate the collider's size and offset from the mesh's geometry
  const { center, halfExtents } = useMemo(() => {
    if (!mesh || !mesh.geometry) {
      // Fallback if mesh not found
      return { center: [0, 0, 0], halfExtents: [0.1, 0.1, 0.1] };
    }

    // Get the mesh's world scale
    const worldScale = new THREE.Vector3();
    mesh.getWorldScale(worldScale);

    // Compute the bounding box in local space
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox!;

    // Get local size and center
    const localSize = box.getSize(new THREE.Vector3());
    const localCenter = box.getCenter(new THREE.Vector3());

    // Apply world scale to the size and center
    const scaledSize = localSize.multiply(worldScale);
    const scaledCenter = localCenter.multiply(worldScale);

    return {
      center: scaledCenter.toArray() as [number, number, number],
      halfExtents: [
        scaledSize.x / 2,
        scaledSize.y / 2,
        scaledSize.z / 2,
      ] as [number, number, number],
    };
  }, [mesh]);

  // On every frame, sync the RigidBody's position
  // to the animated mesh's world position.
  useFrame(() => {
    if (mesh && rigidBodyRef.current) {
      // Get the visual mesh's current world position and rotation
      mesh.getWorldPosition(worldPos);
      mesh.getWorldQuaternion(worldQuat);

      // Apply them to the physics body
      rigidBodyRef.current.setNextKinematicTranslation(worldPos);
      rigidBodyRef.current.setNextKinematicRotation(worldQuat);
    }
  });

  // Don't render anything if the mesh wasn't found
  if (!mesh) {
    return null;
  }

  // Render the invisible kinematic body
  return (
    <RigidBody
      ref={rigidBodyRef}
      type="kinematicPosition"
      colliders={false} // We provide our own collider
    >
      <CuboidCollider
        args={halfExtents}
        position={center} // Apply local offset (now scaled)
      />
    </RigidBody>
  );
}