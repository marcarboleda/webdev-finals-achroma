import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";
import { KinematicMeshCollider } from "../KinematicMeshCollider";

interface WallProps {
  startPos: [number, number, number];
  endPos: [number, number, number];
  height: number;
  depth: number;
}

const Wall: React.FC<WallProps> = ({ startPos, endPos, height, depth }) => {
  const start = new THREE.Vector3(...startPos);
  const end = new THREE.Vector3(...endPos);

  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  direction.normalize();

  // Rotation only on Y axis
  const rotationY = Math.atan2(direction.z, direction.x);

  // Midpoint
  const position = new THREE.Vector3()
    .addVectors(start, end)
    .multiplyScalar(0.5);

  return (
    <RigidBody type="fixed">
      <CuboidCollider
        args={[length / 2, height / 2, depth / 2]}
        position={[position.x, position.y + height / 2, position.z]}
        rotation={[0, rotationY, 0]}
      />
    </RigidBody>
  );
};

export default function BasementWalls({ scene }: { scene: THREE.Group }) {
  return (
    <>
      {/* <KinematicMeshCollider scene={scene} name={"DoorStart"} /> */}

      <Wall
        startPos={[-0.1, 0, 1]}
        endPos={[-9.68, 0, 1]}
        height={3.1}
        depth={0.2}
      />

      <Wall
        startPos={[-9.68, 0, 1.84]}
        endPos={[-12.38, 0, 1.84]}
        height={3.1}
        depth={0.2}
      />

      <Wall
        startPos={[-0.1, 0, -1]}
        endPos={[-11.18, 0, -1]}
        height={3.1}
        depth={0.2}
      />

      <Wall
        endPos={[-11.1, 0, -6.7]}
        startPos={[-11.1, 0, -1]}
        height={3}
        depth={0.2}
      />

      <Wall
        startPos={[-10.5, 0, 1.3]}
        endPos={[-12, 0, 1.32]}
        height={2}
        depth={0.7}
      />

      <Wall
        endPos={[-13.1, 0, -6.7]}
        startPos={[-13.1, 0, 1]}
        height={3}
        depth={0.2}
      />

      <Wall
        endPos={[-12.1, 0, 1]}
        startPos={[-13.1, 0, 1]}
        height={3}
        depth={0.2}
      />
    </>
  );
}
