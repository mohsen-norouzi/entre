import { describe, expect, test } from 'bun:test'
import { SCREEN_WIDTH } from '../src/display-layout'
import { artworkPosition, HOME, ROOM, safeMove, travel } from '../src/navigation'

describe('free gallery navigation', () => {
  test('drag travel is continuous and follows camera direction', () => {
    const forward = travel(HOME, 0, 3, 0)
    expect(forward.z).toBeCloseTo(HOME.z - 3)
    expect(forward.x).toBe(HOME.x)
    const turned = travel(HOME, 0, 3, Math.PI / 2)
    expect(turned.x).toBeCloseTo(HOME.x - 3)
    expect(turned.z).toBeCloseTo(HOME.z)
  })
  test('a large wheel delta cannot leave the gallery', () => {
    const result = safeMove(HOME, {x:100,z:-100}, 20)
    expect(result.x).toBeLessThanOrEqual(ROOM.maxX)
    expect(result.x).toBeGreaterThanOrEqual(ROOM.minX)
    expect(result.z).toBeLessThanOrEqual(ROOM.maxZ)
    expect(result.z).toBeGreaterThanOrEqual(ROOM.minZ)
  })
  test('fast forward movement stops in front of a print instead of tunneling through it', () => {
    const p=artworkPosition(0), s=Math.sin(p.yaw), c=Math.cos(p.yaw)
    const from={x:p.x+s*4,z:p.z+c*4}, to={x:p.x-s*4,z:p.z-c*4}
    const result=safeMove(from,to,20)
    const localZ=(result.x-p.x)*s+(result.z-p.z)*c
    expect(localZ).toBeGreaterThanOrEqual(.449)
  })
  test('the wider fabric screen blocks movement outside the picture edge', () => {
    const p=artworkPosition(0), s=Math.sin(p.yaw), c=Math.cos(p.yaw)
    const edge=SCREEN_WIDTH/2-.05
    const from={x:p.x+c*edge+s*3,z:p.z-s*edge+c*3}
    const to={x:p.x+c*edge-s*3,z:p.z-s*edge-c*3}
    const result=safeMove(from,to,20)
    expect((result.x-p.x)*s+(result.z-p.z)*c).toBeGreaterThanOrEqual(.449)
  })
  test('all 20 works have distinct floor positions and accessible focus locations', () => {
    const positions=Array.from({length:20},(_,i)=>artworkPosition(i))
    expect(new Set(positions.map(p=>`${p.x}:${p.z}`)).size).toBe(20)
    positions.forEach(p=>{
      const target={x:p.x+Math.sin(p.yaw)*9,z:p.z+Math.cos(p.yaw)*9}
      const result=safeMove(target,target,20)
      expect(result.x).toBeCloseTo(target.x)
      expect(result.z).toBeCloseTo(target.z)
    })
  })
  test('open aisles permit both sideways and forward movement', () => {
    const from={x:4.9,z:9},to={x:4.9,z:-28}
    const result=safeMove(from,to,20)
    expect(result.z).toBeCloseTo(to.z)
  })
})
