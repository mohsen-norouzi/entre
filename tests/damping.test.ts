import { expect, test } from 'bun:test'
import { HOME, dampCamera } from '../src/navigation'

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
