import { expect, test } from 'bun:test'
import { CAMERA_DAMPING, HOME, REST_DRAG, consumeDrag, dampCamera, dragIsQuiet, queueDrag } from '../src/navigation'

const destination = { ...HOME, x: 8, z: -12, yaw: 1.2, pitch: .3 }

test('movement eases toward input without snapping or overshooting', () => {
  let pose = { ...HOME }
  const first = dampCamera(pose, destination, 1/60)
  expect(first.x).toBeGreaterThan(HOME.x)
  expect(first.x).toBeLessThan(destination.x * .2)
  for (let frame = 0; frame < 120; frame++) {
    const next = dampCamera(pose, destination, 1/60)
    expect(next.x).toBeGreaterThanOrEqual(pose.x)
    expect(next.x).toBeLessThanOrEqual(destination.x)
    pose = next
  }
  expect(pose.x).toBeCloseTo(destination.x, 4)
  expect(pose.yaw).toBeCloseTo(destination.yaw, 4)
})

test('position and look settle equally at 30, 60, and 144 fps', () => {
  const simulate = (fps: number) => {
    let pose = { ...HOME }
    for(let frame=0;frame<fps;frame++) pose=dampCamera(pose,destination,1/fps)
    return pose
  }
  const baseline=simulate(60)
  for (const fps of [30,144]) {
    const pose=simulate(fps)
    expect(pose.x).toBeCloseTo(baseline.x,10)
    expect(pose.z).toBeCloseTo(baseline.z,10)
    expect(pose.yaw).toBeCloseTo(baseline.yaw,10)
    expect(pose.pitch).toBeCloseTo(baseline.pitch,10)
  }
})

test('reduced motion applies input immediately; paused time does not move', () => {
  expect(dampCamera(HOME,destination,1/60,true)).toEqual(destination)
  expect(dampCamera(HOME,destination,0)).toEqual(HOME)
})

test('a drag step only releases a small fraction on the first frame', () => {
  const queued = queueDrag(REST_DRAG, { side: 4, forward: -2 })
  const first = consumeDrag(queued, 1/60)
  expect(first.applied.side).toBeGreaterThan(0)
  expect(first.applied.side).toBeLessThan(queued.side * 0.08)
  expect(first.applied.side + first.pending.side).toBeCloseTo(queued.side, 10)
  expect(first.applied.forward + first.pending.forward).toBeCloseTo(queued.forward, 10)
})

test('queued drag eases out without reversing or overshooting', () => {
  let pending = queueDrag(REST_DRAG, { side: 6, forward: -3, yaw: .5, pitch: -.2 })
  const total = pending.side
  let applied = 0
  for (let frame = 0; frame < 360; frame++) {
    const next = consumeDrag(pending, 1/60)
    expect(Math.abs(next.applied.side + next.pending.side)).toBeCloseTo(Math.abs(pending.side), 10)
    expect(Math.sign(next.applied.side) === 0 || Math.sign(next.applied.side) === Math.sign(pending.side)).toBe(true)
    applied += next.applied.side
    pending = next.pending
  }
  expect(applied + pending.side).toBeCloseTo(total, 8)
  expect(dragIsQuiet(pending)).toBe(true)
})

test('a flick covers the same coast at 30, 60, and 144 fps', () => {
  const simulate = (fps: number) => {
    let pending = queueDrag(REST_DRAG, { side: 5 })
    let distance = 0
    for (let frame = 0; frame < fps; frame++) {
      const coast = consumeDrag(pending, 1 / fps)
      distance += coast.applied.side
      pending = coast.pending
    }
    return distance
  }
  const baseline = simulate(60)
  expect(baseline).toBeCloseTo(5 * -Math.expm1(-CAMERA_DAMPING.drag), 8)
  for (const fps of [30, 144]) expect(simulate(fps)).toBeCloseTo(baseline, 8)
})

test('reduced motion applies the whole queued drag at once', () => {
  const queued = queueDrag(REST_DRAG, { side: 3, yaw: .4 })
  expect(consumeDrag(queued, 1/60, true)).toEqual({ applied: queued, pending: REST_DRAG })
  expect(consumeDrag(queued, 0)).toEqual({ applied: REST_DRAG, pending: queued })
})
