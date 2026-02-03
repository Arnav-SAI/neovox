import React, { useEffect, useRef, useState, useMemo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { PointerLockControls, Grid, Stars } from '@react-three/drei'
import * as THREE from 'three'
import { useVoxelStore } from './VoxelStore'

const MAX_INSTANCES = 100000

// Generate a texture for the "Glass Edge" look
function createEdgeTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')

    // Clear/Background (Transparent)
    ctx.clearRect(0, 0, 64, 64)

    // Fill background with very low opacity for "Glass" body
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.fillRect(0, 0, 64, 64)

    // Border
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 8
    ctx.strokeRect(0, 0, 64, 64)

    // Inner Border for crispiness
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 2
    ctx.strokeRect(4, 4, 56, 56)

    const texture = new THREE.CanvasTexture(canvas)
    texture.magFilter = THREE.NearestFilter // Keep pixels sharp
    return texture
}

function VoxelInstances() {
    const voxels = useVoxelStore((state) => state.voxels)
    const meshRef = useRef()
    const dummy = useMemo(() => new THREE.Object3D(), [])
    const colorHelper = useMemo(() => new THREE.Color(), [])
    const texture = useMemo(() => createEdgeTexture(), [])

    useEffect(() => {
        if (!meshRef.current) return

        // Update the instance count
        meshRef.current.count = voxels.length

        // Update the matrix and color for each voxel
        voxels.forEach((voxel, i) => {
            dummy.position.set(voxel.x, voxel.y, voxel.z)
            dummy.updateMatrix()
            meshRef.current.setMatrixAt(i, dummy.matrix)

            // Set Color
            meshRef.current.setColorAt(i, colorHelper.set(voxel.color || '#00d2ff'))
        })

        meshRef.current.instanceMatrix.needsUpdate = true
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true

        // FIX: Set bounding sphere to infinity so Raycaster checks ALL instances, 
        // otherwise it only checks instances near 0,0,0 (where the original geometry is).
        meshRef.current.computeBoundingSphere = () => {
            meshRef.current.boundingSphere = new THREE.Sphere(undefined, Infinity);
        }
        meshRef.current.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
    }, [voxels, dummy, colorHelper])

    return (
        <instancedMesh ref={meshRef} args={[null, null, MAX_INSTANCES]} name="voxels" frustumCulled={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
                map={texture}
                transparent={true}
                opacity={1}
                alphaTest={0.1}
                side={THREE.DoubleSide}
            />
        </instancedMesh>
    )
}

function Player() {
    const { camera } = useThree()
    const [move, setMove] = useState({ forward: false, backward: false, left: false, right: false, up: false, down: false })

    useEffect(() => {
        const handleKeyDown = (e) => {
            switch (e.code) {
                case 'KeyW': setMove(m => ({ ...m, forward: true })); break;
                case 'KeyS': setMove(m => ({ ...m, backward: true })); break;
                case 'KeyA': setMove(m => ({ ...m, left: true })); break;
                case 'KeyD': setMove(m => ({ ...m, right: true })); break;
                case 'Space': setMove(m => ({ ...m, up: true })); break;
                case 'ShiftLeft': setMove(m => ({ ...m, down: true })); break;
            }
        }
        const handleKeyUp = (e) => {
            switch (e.code) {
                case 'KeyW': setMove(m => ({ ...m, forward: false })); break;
                case 'KeyS': setMove(m => ({ ...m, backward: false })); break;
                case 'KeyA': setMove(m => ({ ...m, left: false })); break;
                case 'KeyD': setMove(m => ({ ...m, right: false })); break;
                case 'Space': setMove(m => ({ ...m, up: false })); break;
                case 'ShiftLeft': setMove(m => ({ ...m, down: false })); break;
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        document.addEventListener('keyup', handleKeyUp)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.removeEventListener('keyup', handleKeyUp)
        }
    }, [])

    useFrame((state, delta) => {
        const speed = 10 * delta
        const euler = new THREE.Euler(0, camera.rotation.y, 0, 'YXZ')

        const frontVector = new THREE.Vector3(0, 0, Number(move.backward) - Number(move.forward))
        const sideVector = new THREE.Vector3(Number(move.left) - Number(move.right), 0, 0)

        const horizontalDir = new THREE.Vector3()
        horizontalDir.subVectors(frontVector, sideVector).normalize().applyEuler(euler).multiplyScalar(speed)

        camera.position.add(horizontalDir)
        camera.position.y += (Number(move.up) - Number(move.down)) * speed
    })

    return null
}

function Interaction() {
    const { camera, scene } = useThree()
    const [ghost, setGhost] = useState(null)
    const addVoxel = useVoxelStore((state) => state.addVoxel)
    const removeVoxel = useVoxelStore((state) => state.removeVoxel)
    const voxels = useVoxelStore((state) => state.voxels)
    const selectedColor = useVoxelStore((state) => state.selectedColor)

    // Store hover state to know if we are targeting a deletion or addition
    const [isHoveringVoxel, setIsHoveringVoxel] = useState(false)
    const [hoveredVoxelId, setHoveredVoxelId] = useState(null)

    const raycaster = useMemo(() => new THREE.Raycaster(), [])
    const center = useMemo(() => new THREE.Vector2(0, 0), [])

    useFrame(() => {
        raycaster.setFromCamera(center, camera)

        const interactables = []
        const voxelMesh = scene.getObjectByName('voxels')
        const ground = scene.getObjectByName('ground')

        if (voxelMesh) interactables.push(voxelMesh)
        if (ground) interactables.push(ground)

        const intersects = raycaster.intersectObjects(interactables, false)

        if (intersects.length > 0) {
            const hit = intersects[0]

            // Check if we hit an existing voxel
            if (hit.object.name === 'voxels') {
                setIsHoveringVoxel(true)
                // Get the instanceId to identify which voxel we hit for deletion
                // InstancedMesh raycasting returns instanceId
                if (hit.instanceId !== undefined) {
                    // Find the corresponding voxel in our store based on index
                    // Note: We blindly assume the index matches the array order. 
                    // Since we render 'voxels' array in order, it should match 1:1.
                    const targetVoxel = voxels[hit.instanceId]
                    if (targetVoxel) {
                        setHoveredVoxelId(targetVoxel.id) // Assuming Supabase or local ID
                        // Fallback if no ID (local optimistic): use coordinate key or just index? 
                        // Zustand store remove might rely on ID.
                        // For now, let's assume we might need to find it by coord if ID is missing.
                    }
                }
            } else {
                setIsHoveringVoxel(false)
                setHoveredVoxelId(null)
            }

            // Calculate snapped position for placement (adjacent)
            const p = hit.point.clone().add(hit.face.normal.clone().multiplyScalar(0.5))
            const x = Math.round(p.x)
            const y = Math.round(p.y)
            const z = Math.round(p.z)
            setGhost({ x, y, z })
        } else {
            setGhost(null)
            setIsHoveringVoxel(false)
        }
    })

    useEffect(() => {
        const handleMouseDown = (e) => {
            if (!ghost) return

            // Left Click = Add
            if (e.button === 0 && !e.altKey) {
                addVoxel(ghost.x, ghost.y, ghost.z)
            }
            // Alt + Left Click = Remove (if hovering a voxel)
            if (e.button === 0 && e.altKey && isHoveringVoxel && hoveredVoxelId) {
                removeVoxel(hoveredVoxelId)
            }
        }

        window.addEventListener('mousedown', handleMouseDown)
        return () => window.removeEventListener('mousedown', handleMouseDown)
    }, [ghost, addVoxel, removeVoxel, isHoveringVoxel, hoveredVoxelId])

    return ghost ? (
        <mesh position={[ghost.x, ghost.y, ghost.z]}>
            <boxGeometry args={[1.01, 1.01, 1.01]} />
            <meshBasicMaterial color={selectedColor} wireframe />
        </mesh>
    ) : null
}

export default function VoxelEngine() {
    useEffect(() => console.log("VoxelEngine mounted"), [])
    return (
        <Canvas shadows camera={{ position: [0, 5, 10], fov: 60 }} gl={{ clearColor: '#000000' }}>
            <fog attach="fog" args={['#000', 10, 60]} />
            <ambientLight intensity={0.2} />
            <pointLight position={[10, 20, 10]} intensity={1} castShadow />

            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

            {/* Dark Grid */}
            <Grid infiniteGrid sectionSize={1} cellColor="#1a1a1a" sectionColor="#333" fadeDistance={40} />

            <mesh name="ground" rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
                <planeGeometry args={[1000, 1000]} />
                <meshBasicMaterial transparent opacity={0} />
            </mesh>

            <Player />
            <VoxelInstances />
            <Interaction />
            <PointerLockControls />
        </Canvas>
    )
}
