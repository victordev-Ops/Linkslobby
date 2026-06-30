"use client"
import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { RoundedBox } from "@react-three/drei"
import * as THREE from "three"

/**
 * Real articulated hand geometry: a palm block, four fingers (each a knuckle joint +
 * proximal segment + a second joint + distal segment), and a thumb (swing joint + curl
 * joint + two segments). Gestures are achieved by rotating actual joints, not by
 * swapping or morphing a silhouette — this is the same rigging approach a low-poly
 * character hand would use.
 */

type Gesture = "rock" | "paper" | "scissors"

type FingerPose = { curl1: number; curl2: number }
type ThumbPose = { swing: number; curl1: number; curl2: number }
type HandPose = { fingers: [FingerPose, FingerPose, FingerPose, FingerPose]; thumb: ThumbPose }

// Finger order: [pinky, ring, middle, index]
const POSES: Record<Gesture, HandPose> = {
    rock: {
        fingers: [
            { curl1: 1.95, curl2: 1.7 },
            { curl1: 2.0, curl2: 1.75 },
            { curl1: 2.0, curl2: 1.75 },
            { curl1: 1.9, curl2: 1.65 },
        ],
        thumb: { swing: 0.25, curl1: 0.9, curl2: 0.6 },
    },
    paper: {
        fingers: [
            { curl1: 0.04, curl2: 0.04 },
            { curl1: 0.02, curl2: 0.02 },
            { curl1: 0.0, curl2: 0.0 },
            { curl1: 0.02, curl2: 0.02 },
        ],
        thumb: { swing: -0.95, curl1: 0.05, curl2: 0.05 },
    },
    scissors: {
        fingers: [
            { curl1: 1.95, curl2: 1.7 }, // pinky curled
            { curl1: 2.0, curl2: 1.75 }, // ring curled
            { curl1: 0.02, curl2: 0.02 }, // middle extended
            { curl1: 0.02, curl2: 0.02 }, // index extended
        ],
        thumb: { swing: 0.35, curl1: 0.85, curl2: 0.55 },
    },
}

const GESTURE_ORDER: Gesture[] = ["rock", "paper", "scissors"]

const FINGER_LAYOUT = [
    { y: -0.34, len1: 0.22, len2: 0.14, radius: 0.052 }, // pinky
    { y: -0.115, len1: 0.3, len2: 0.19, radius: 0.058 }, // ring
    { y: 0.115, len1: 0.34, len2: 0.22, radius: 0.06 }, // middle
    { y: 0.34, len1: 0.31, len2: 0.2, radius: 0.058 }, // index
] as const

function easeInOutCubic(t: number) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t
}

function Segment({ length, radius, color }: { length: number; radius: number; color: string }) {
    return (
        <mesh position={[length / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow receiveShadow>
            <capsuleGeometry args={[radius, Math.max(length - radius * 0.6, 0.02), 6, 10]} />
            <meshPhysicalMaterial color={color} roughness={0.45} metalness={0.05} clearcoat={0.25} clearcoatRoughness={0.4} />
        </mesh>
    )
}

function Finger({
    y,
    len1,
    len2,
    radius,
    color,
    poseRef,
    index,
}: {
    y: number
    len1: number
    len2: number
    radius: number
    color: string
    poseRef: React.MutableRefObject<HandPose>
    index: number
}) {
    const joint1 = useRef<THREE.Group>(null!)
    const joint2 = useRef<THREE.Group>(null!)

    useFrame(() => {
        const p = poseRef.current.fingers[index]
        if (joint1.current) joint1.current.rotation.y = p.curl1
        if (joint2.current) joint2.current.rotation.y = p.curl2
    })

    return (
        <group position={[0.25, y, 0]}>
            <group ref={joint1}>
                <Segment length={len1} radius={radius} color={color} />
                <group ref={joint2} position={[len1, 0, 0]}>
                    <Segment length={len2} radius={radius * 0.85} color={color} />
                    <mesh position={[len2, 0, 0]} castShadow>
                        <sphereGeometry args={[radius * 0.8, 10, 10]} />
                        <meshPhysicalMaterial color={color} roughness={0.4} metalness={0.05} clearcoat={0.3} />
                    </mesh>
                </group>
            </group>
        </group>
    )
}

function Thumb({ color, poseRef }: { color: string; poseRef: React.MutableRefObject<HandPose> }) {
    const swing = useRef<THREE.Group>(null!)
    const joint1 = useRef<THREE.Group>(null!)
    const joint2 = useRef<THREE.Group>(null!)

    useFrame(() => {
        const p = poseRef.current.thumb
        if (swing.current) swing.current.rotation.z = p.swing
        if (joint1.current) joint1.current.rotation.y = p.curl1
        if (joint2.current) joint2.current.rotation.y = p.curl2
    })

    return (
        <group position={[-0.02, -0.4, 0.06]}>
            <group ref={swing}>
                <group ref={joint1} rotation={[0, 0.5, 0]}>
                    <Segment length={0.22} radius={0.062} color={color} />
                    <group ref={joint2} position={[0.22, 0, 0]}>
                        <Segment length={0.16} radius={0.052} color={color} />
                        <mesh position={[0.16, 0, 0]} castShadow>
                            <sphereGeometry args={[0.044, 10, 10]} />
                            <meshPhysicalMaterial color={color} roughness={0.4} metalness={0.05} clearcoat={0.3} />
                        </mesh>
                    </group>
                </group>
            </group>
        </group>
    )
}

export function RPSHand3D({
    side,
    color,
    animate,
    cycleDuration = 3,
}: {
    side: "left" | "right"
    color: string
    animate: boolean
    cycleDuration?: number
}) {
    const group = useRef<THREE.Group>(null!)
    const poseRef = useRef<HandPose>(POSES.rock)
    const tmpPose = useMemo<HandPose>(
        () => ({
            fingers: [{ curl1: 0, curl2: 0 }, { curl1: 0, curl2: 0 }, { curl1: 0, curl2: 0 }, { curl1: 0, curl2: 0 }],
            thumb: { swing: 0, curl1: 0, curl2: 0 },
        }),
        []
    )

    useFrame((state) => {
        if (!animate) {
            poseRef.current = POSES.rock
            return
        }
        const t = state.clock.getElapsedTime() % cycleDuration
        const segmentDur = cycleDuration / GESTURE_ORDER.length
        const segIndex = Math.floor(t / segmentDur)
        const localT = (t % segmentDur) / segmentDur
        const eased = easeInOutCubic(localT)

        const a = POSES[GESTURE_ORDER[segIndex]]
        const b = POSES[GESTURE_ORDER[(segIndex + 1) % GESTURE_ORDER.length]]

        for (let i = 0; i < 4; i++) {
            tmpPose.fingers[i].curl1 = lerp(a.fingers[i].curl1, b.fingers[i].curl1, eased)
            tmpPose.fingers[i].curl2 = lerp(a.fingers[i].curl2, b.fingers[i].curl2, eased)
        }
        tmpPose.thumb.swing = lerp(a.thumb.swing, b.thumb.swing, eased)
        tmpPose.thumb.curl1 = lerp(a.thumb.curl1, b.thumb.curl1, eased)
        tmpPose.thumb.curl2 = lerp(a.thumb.curl2, b.thumb.curl2, eased)
        poseRef.current = tmpPose

        // punch toward center, peaking mid-transition
        const punch = Math.sin(eased * Math.PI) * 0.16
        const dir = side === "left" ? 1 : -1
        if (group.current) {
            group.current.position.x = (side === "left" ? -1.05 : 1.05) + dir * punch
            group.current.rotation.y = (side === "left" ? 0.35 : -0.35) - dir * punch * 0.4
        }
    })

    const mirror = side === "right"

    return (
        <group ref={group} position={[side === "left" ? -1.05 : 1.05, -0.05, 0]}>
            <group scale={mirror ? [-1, 1, 1] : [1, 1, 1]}>
                {/* forearm */}
                <mesh position={[-0.55, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.16, 0.19, 0.5, 16]} />
                    <meshPhysicalMaterial color={color} roughness={0.5} metalness={0.05} clearcoat={0.2} />
                </mesh>

                {/* palm */}
                <RoundedBox args={[0.5, 0.85, 0.24]} radius={0.09} smoothness={4} position={[0, 0, 0]} castShadow receiveShadow>
                    <meshPhysicalMaterial color={color} roughness={0.45} metalness={0.05} clearcoat={0.25} clearcoatRoughness={0.4} />
                </RoundedBox>

                {FINGER_LAYOUT.map((f, i) => (
                    <Finger key={i} index={i} y={f.y} len1={f.len1} len2={f.len2} radius={f.radius} color={color} poseRef={poseRef} />
                ))}

                <Thumb color={color} poseRef={poseRef} />
            </group>
        </group>
    )
}
