"use client"
import { Canvas } from "@react-three/fiber"
import { PerspectiveCamera, ContactShadows, Environment } from "@react-three/drei"
import { RPSHand3D } from "./RPSHand3D"

export function RPSHandsScene({ reduceMotion }: { reduceMotion: boolean }) {
    return (
        <Canvas shadows dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}>
            <PerspectiveCamera makeDefault position={[0, 0.35, 3]} fov={32} />

            <ambientLight intensity={0.5} />
            <directionalLight
                position={[1.5, 3, 2]}
                intensity={1.3}
                castShadow
                shadow-mapSize={[1024, 1024]}
                shadow-bias={-0.0005}
            />
            <pointLight position={[-2.2, 1, 1.2]} intensity={0.7} color="#10b981" />
            <pointLight position={[2.2, 1, 1.2]} intensity={0.7} color="#2dd4bf" />

            <Environment preset="city" environmentIntensity={0.35} />

            <RPSHand3D side="left" color="#34d399" animate={!reduceMotion} />
            <RPSHand3D side="right" color="#5eead4" animate={!reduceMotion} />

            <ContactShadows position={[0, -0.62, 0]} opacity={0.45} scale={4} blur={2.2} far={1.2} />
        </Canvas>
    )
}

export default RPSHandsScene
