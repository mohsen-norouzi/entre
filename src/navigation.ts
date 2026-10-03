import { SCREEN_WIDTH } from './display-layout'

export type CameraPosition = { x: number; z: number }
export const ROOM = { minX: -18, maxX: 18, minZ: -34, maxZ: 14 }
export const HOME = { x: 0, y: 2, z: 10.6, yaw: 0, pitch: -0.032 }
export function artworkPosition(index: number) {
  const columns = [2, 1, 3, 0, 4]
  const row = Math.floor(index / 5)
  return { x: (columns[index % 5] - 2) * 6 + 1.1 + (row % 2 ? 1.6 : 0), y: 2.05 + (index % 3 - 1) * .12, z: .55 - row * 8.4, yaw: index % 2 ? .12 : -.16 }
}
export function travel(position: CameraPosition, sideways: number, forward: number, yaw: number) {
  return { x: position.x + sideways * Math.cos(yaw) - forward * Math.sin(yaw), z: position.z - sideways * Math.sin(yaw) - forward * Math.cos(yaw) }
}
export function safeMove(from: CameraPosition, to: CameraPosition, count: number): CameraPosition {
  let point = { ...from }
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / .18))
  const dx = (to.x - from.x) / steps, dz = (to.z - from.z) / steps
  for (let step = 0; step < steps; step++) {
    const next = { x: Math.max(ROOM.minX, Math.min(ROOM.maxX, point.x + dx)), z: Math.max(ROOM.minZ, Math.min(ROOM.maxZ, point.z + dz)) }
    for (let i = 0; i < count; i++) {
      const p = artworkPosition(i), c = Math.cos(p.yaw), s = Math.sin(p.yaw)
      const localX = (next.x - p.x) * c - (next.z - p.z) * s
      const localZ = (next.x - p.x) * s + (next.z - p.z) * c
      if (Math.abs(localX) < SCREEN_WIDTH / 2 + .28 && Math.abs(localZ) < .45) {
        const previousZ = (point.x - p.x) * s + (point.z - p.z) * c
        const correction = (previousZ >= 0 ? .45 : -.45) - localZ
        next.x += correction * s; next.z += correction * c
      }
    }
    if (next.x >= ROOM.minX && next.x <= ROOM.maxX && next.z >= ROOM.minZ && next.z <= ROOM.maxZ) point = next
  }
  return point
}

export type CameraPose = typeof HOME
export type DragOffset = { side: number; forward: number; yaw: number; pitch: number }
export const REST_DRAG: DragOffset = { side: 0, forward: 0, yaw: 0, pitch: 0 }
export const CAMERA_DAMPING = { movement: 7.5, look: 10, drag: 2.6 }

// Exponential response gives the same settling time at any display refresh rate.
export function dampCamera(current: CameraPose, target: CameraPose, deltaSeconds: number, reduced = false): CameraPose {
  if (reduced) return { ...target }
  const dt = Math.max(0, deltaSeconds)
  const move = -Math.expm1(-CAMERA_DAMPING.movement * dt)
  const look = -Math.expm1(-CAMERA_DAMPING.look * dt)
  return {
    x: current.x + (target.x - current.x) * move,
    y: current.y + (target.y - current.y) * move,
    z: current.z + (target.z - current.z) * move,
    yaw: current.yaw + (target.yaw - current.yaw) * look,
    pitch: current.pitch + (target.pitch - current.pitch) * look,
  }
}

export function queueDrag(pending: DragOffset, step: Partial<DragOffset>): DragOffset {
  return {
    side: pending.side + (step.side ?? 0),
    forward: pending.forward + (step.forward ?? 0),
    yaw: pending.yaw + (step.yaw ?? 0),
    pitch: pending.pitch + (step.pitch ?? 0),
  }
}

export function consumeDrag(pending: DragOffset, deltaSeconds: number, reduced = false): { applied: DragOffset; pending: DragOffset } {
  if (reduced) return { applied: { ...pending }, pending: { ...REST_DRAG } }
  const dt = Math.max(0, deltaSeconds)
  if (dt === 0) return { applied: { ...REST_DRAG }, pending: { ...pending } }
  const factor = -Math.expm1(-CAMERA_DAMPING.drag * dt)
  return {
    applied: {
      side: pending.side * factor,
      forward: pending.forward * factor,
      yaw: pending.yaw * factor,
      pitch: pending.pitch * factor,
    },
    pending: {
      side: pending.side * (1 - factor),
      forward: pending.forward * (1 - factor),
      yaw: pending.yaw * (1 - factor),
      pitch: pending.pitch * (1 - factor),
    },
  }
}

export function dragIsQuiet(pending: DragOffset, epsilon = 1e-4) {
  return Math.hypot(pending.side, pending.forward) < epsilon && Math.hypot(pending.yaw, pending.pitch) < epsilon
}
