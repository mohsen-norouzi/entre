import * as THREE from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'

import { SCREEN_WIDTH, FLOOR_Y } from './display-layout'

// Small repeatable material maps keep the room local and inexpensive to load.
function surfaceTexture(kind: 'stone' | 'linen') {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 512
  const ctx = canvas.getContext('2d')!
  const pixels = ctx.createImageData(512, 512)
  let seed = 71
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
  const fibers = Array.from({length:512}, () => random())
  for (let y=0;y<512;y++) for (let x=0;x<512;x++) {
    const value = kind === 'linen'
      ? 232 + fibers[x]*17 + Math.sin(x*.16)*3 + random()*5
      : 220 + Math.sin(x*.041 + Math.sin(y*.028)*2)*3 + Math.sin(y*.019+x*.013)*4 + random()*10
    const i = (y*512+x)*4
    pixels.data[i] = value; pixels.data[i+1] = value; pixels.data[i+2] = value; pixels.data[i+3] = 255
  }
  ctx.putImageData(pixels,0,0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function createArchitecture(scene: THREE.Scene, mobile: boolean) {
  const stone = surfaceTexture('stone'); stone.repeat.set(12,12)
  const linen = surfaceTexture('linen'); linen.repeat.set(1,2)
  const plaster = new THREE.MeshStandardMaterial({ color:'#e5dfd2', roughness:.94 })
  const bronze = new THREE.MeshStandardMaterial({ color:'#887762', roughness:.42, metalness:.55 })
  const scrim = new THREE.MeshStandardMaterial({
    color:'#eee6d6', map:linen, roughness:.93, transparent:true, opacity:.83,
    depthWrite:false, side:THREE.DoubleSide,
  })
  const floorMaterial = new THREE.MeshStandardMaterial({ color:'#c9beaa', map:stone, bumpMap:stone, bumpScale:.025, roughness:.36, metalness:.08 })
  const reflection = new Reflector(new THREE.PlaneGeometry(52,68), {
    textureWidth:mobile?384:768, textureHeight:mobile?384:768, clipBias:.004, multisample:0,
  })
  reflection.rotation.x=-Math.PI/2; reflection.position.set(0,FLOOR_Y-.035,-12)
  // Render the reflection texture first; the lit stone shader blends it gently into the floor.
  const reflectionMaterial = reflection.material as THREE.ShaderMaterial
  reflectionMaterial.colorWrite=false; reflectionMaterial.depthWrite=false; reflection.renderOrder=-1
  const updateReflection = reflection.onBeforeRender
  reflection.onBeforeRender = function (...args) {
    // The depth-of-field pass needs depth only, not a second reflected scene.
    if (!args[1].overrideMaterial) updateReflection.apply(this, args)
  }
  scene.add(reflection)
  floorMaterial.onBeforeCompile = shader => {
    shader.uniforms.galleryReflection={value:reflection.getRenderTarget().texture}
    shader.uniforms.galleryReflectionMatrix=reflectionMaterial.uniforms.textureMatrix
    shader.vertexShader='uniform mat4 galleryReflectionMatrix; varying vec4 vGalleryReflection;\n'+shader.vertexShader
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGalleryReflection = galleryReflectionMatrix * vec4(position, 1.0);')
    shader.fragmentShader='uniform sampler2D galleryReflection; varying vec4 vGalleryReflection;\n'+shader.fragmentShader
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>', `
      vec2 reflectionUv = vGalleryReflection.xy / vGalleryReflection.w;
      vec3 reflected = vec3(0.0);
      for (int x=-1; x<=1; x++) for (int y=-1; y<=1; y++) {
        reflected += texture2D(galleryReflection, reflectionUv + vec2(float(x),float(y))*.0035).rgb / 9.0;
      }
      outgoingLight = mix(outgoingLight, reflected, .16);
      #include <opaque_fragment>
    `)
  }
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(52,68),floorMaterial)
  floor.rotation.x=-Math.PI/2;floor.position.set(0,FLOOR_Y,-12);floor.receiveShadow=true;scene.add(floor)
  const box=(size:[number,number,number], position:[number,number,number], material:THREE.Material=plaster) => {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material)
    mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh
  }
  box([52,14,.4],[0,5.95,-43])
  box([.4,14,68],[-24,5.95,-12])
  box([52,.3,68],[0,12.8,-12])
  // Sun enters between structural piers, making real bands of light and shade.
  for(let i=0;i<13;i++) {
    box([.65,14,.55],[22,5.9,-40+i*4.5])
    box([.7,.16,3.95],[22,5.3,-37.75+i*4.5])
  }
  const windowMaterial=new THREE.MeshBasicMaterial({color:'#fff3d8',toneMapped:false})
  const windows=new THREE.Mesh(new THREE.PlaneGeometry(68,14),windowMaterial)
  windows.rotation.y=-Math.PI/2;windows.position.set(22.5,5.9,-12);scene.add(windows)
  for(let i=0;i<9;i++) box([.12,1.1,68],[-22+i*5.5,12.1,-12])
  return {
    bronze, scrim, linen, floor,
    dispose:()=>{stone.dispose();linen.dispose();reflection.dispose()},
    windowMaterial,
  }
}

export function createDisplay(panel: THREE.Group, artTexture: THREE.Texture, scrim: THREE.Material, bronze: THREE.Material, centerY: number, width=2.78, height=4.18) {
  const screenHeight=13.8
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_WIDTH,screenHeight),scrim)
  screen.position.set(0,FLOOR_Y+screenHeight/2-centerY,0)
  panel.add(screen)
  // A separate narrow foot anchors each luminous screen to the floor.
  const foot=new THREE.Mesh(new THREE.BoxGeometry(SCREEN_WIDTH+.05,.045,.14),bronze)
  foot.position.set(0,FLOOR_Y-centerY+.03,0);foot.castShadow=true;panel.add(foot)
  const edge=new THREE.MeshStandardMaterial({color:'#51483a',roughness:.6,metalness:.25})
  const artMaterial=new THREE.MeshStandardMaterial({map:artTexture,roughness:.83,metalness:0,emissive:'#ffffff',emissiveMap:artTexture,emissiveIntensity:.4})
  const geometry=new THREE.BoxGeometry(width,height,.065)
  // Solid prints on both sides, offset from the scrim: no coplanar surfaces.
  const front=new THREE.Mesh(geometry,[edge,edge,edge,edge,artMaterial,artMaterial])
  front.position.z=.085;front.castShadow=true;front.receiveShadow=false;panel.add(front)
  const back=front.clone();back.position.z=-.085;panel.add(back)
  for(const depth of [-.09,.09]) {
    for(const side of [-1,1]) {
      const vertical=new THREE.Mesh(new THREE.BoxGeometry(.032,height+.064,.095),bronze)
      vertical.position.set(side*(width/2+.016),0,depth);vertical.castShadow=true;panel.add(vertical)
      const horizontal=new THREE.Mesh(new THREE.BoxGeometry(width,.032,.095),bronze)
      horizontal.position.set(0,side*(height/2+.016),depth);horizontal.castShadow=true;panel.add(horizontal)
    }
  }
  return [front,back]
}
