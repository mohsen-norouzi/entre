import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js'
import gsap from 'gsap'
import { artworks, wrap } from './artworks'
import { createArchitecture, createDisplay } from './architecture'
import { artworkPosition, HOME, REST_DRAG, consumeDrag, dampCamera, dragIsQuiet, queueDrag, safeMove, travel } from './navigation'

type Props = {
  active: number; focus: { index: number; nonce: number }; home: number; dusk: boolean; reduced: boolean; blocked: boolean; lookMode: boolean
  onSelect: (i: number) => void; onReady: () => void; onMove: () => void
  onPosition: (position: { x: number; z: number; yaw: number; nearest: number | null }) => void
}
type SceneApi = { focus: (index: number) => void; home: () => void; light: (dusk: boolean) => void; stop: () => void }
export default function GalleryScene({ active, focus, home, dusk, reduced, blocked, lookMode, onSelect, onReady, onMove, onPosition }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const api = useRef<SceneApi | null>(null)
  const callbacks = useRef({ onSelect, onReady, onMove, onPosition })
  callbacks.current = { onSelect, onReady, onMove, onPosition }
  const preferences = useRef({ reduced, blocked, lookMode })
  preferences.current = { reduced, blocked, lookMode }
  const [fallback, setFallback] = useState(false)
  useEffect(() => {
    const element = host.current!
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' }) }
    catch { setFallback(true); callbacks.current.onReady(); return }
    let disposed = false
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 700 ? 1.25 : 1.5))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    element.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#d8cfbf')
    scene.fog = new THREE.FogExp2('#d8cfbf', 0.009)
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 70)
    const entrance = { ...HOME, x: window.innerWidth < 700 ? artworkPosition(0).x : HOME.x }
    const state = { ...entrance }
    const targetPose = { ...entrance }
    camera.position.set(state.x, state.y, state.z)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(state.pitch, state.yaw, 0)
    const ambient = new THREE.HemisphereLight('#fff6e7', '#c4b69e', 1.85)
    scene.add(ambient)
    const sun = new THREE.DirectionalLight('#fff0d5', 2.7)
    sun.position.set(24, 18, 10)
    sun.target.position.set(-6, -1, -16)
    sun.castShadow = true
    sun.shadow.mapSize.set(window.innerWidth < 700 ? 2048 : 4096, window.innerWidth < 700 ? 2048 : 4096)
    sun.shadow.radius = 3
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 0.5, far: 75 })
    sun.shadow.normalBias = 0.03
    sun.shadow.bias = -0.0003
    scene.add(sun, sun.target)
    const fill = new THREE.DirectionalLight('#d8dce5', 0.35)
    fill.position.set(-6, 4, 7)
    scene.add(fill)
    const architecture = createArchitecture(scene, window.innerWidth < 700)
    // Soft pool of bounced daylight, layered over the physical floor lighting.
    const lightCanvas = document.createElement('canvas')
    lightCanvas.width = 256; lightCanvas.height = 256
    const ctx = lightCanvas.getContext('2d')!
    const gradient = ctx.createRadialGradient(128,128,5,128,128,125)
    gradient.addColorStop(0,'rgba(255,235,203,0.8)'); gradient.addColorStop(0.45,'rgba(255,235,203,0.45)'); gradient.addColorStop(1,'rgba(255,235,203,0)')
    ctx.fillStyle = gradient; ctx.fillRect(0,0,256,256)
    const lightTexture = new THREE.CanvasTexture(lightCanvas)
    const pools: THREE.Mesh[] = []
    for (let i = 0; i < 10; i++) {
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(55, 1.8), new THREE.MeshBasicMaterial({ map: lightTexture, transparent: true, opacity: 0.18, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, blending: THREE.AdditiveBlending }))
      pool.rotation.set(-Math.PI / 2, 0, -0.38)
      pool.position.set(0, -1.042 + i * .001, -33 + i * 5)
      pool.renderOrder = 1
      scene.add(pool); pools.push(pool)
    }
    const loader = new THREE.TextureLoader()
    const textures: THREE.Texture[] = []
    let loaded = 0
    const loadingTimeout = window.setTimeout(() => { if (!disposed) callbacks.current.onReady() }, 15000)
    artworks.forEach((art) => {
      const tex = loader.load(art.image, () => { if (!disposed && ++loaded === artworks.length) {clearTimeout(loadingTimeout); callbacks.current.onReady()} }, undefined, () => { if (!disposed) { setFallback(true); callbacks.current.onReady() } })
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
      textures.push(tex)
    })
    const panels: THREE.Group[] = []
    const faces: THREE.Mesh[] = []
    const shadowCanvas = document.createElement('canvas')
    shadowCanvas.width = 128; shadowCanvas.height = 128
    const shadowCtx = shadowCanvas.getContext('2d')!
    const shadowGradient = shadowCtx.createRadialGradient(64,64,0,64,64,64)
    shadowGradient.addColorStop(0,'rgba(37,31,24,.35)'); shadowGradient.addColorStop(.35,'rgba(37,31,24,.2)'); shadowGradient.addColorStop(1,'rgba(37,31,24,0)')
    shadowCtx.fillStyle = shadowGradient; shadowCtx.fillRect(0,0,128,128)
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas)
    const softShadows: THREE.Mesh[] = []
    artworks.forEach((_, i) => {
      const panel = new THREE.Group()
      const position = artworkPosition(i)
      const prints = createDisplay(panel, textures[i], architecture.scrim, architecture.bronze, position.y)
      prints.forEach(print => { print.userData.index = i; faces.push(print) })
      panel.position.set(position.x, position.y, position.z); panel.rotation.y = position.yaw
      scene.add(panel); panels.push(panel)
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.2), new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: .4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }))
      shadow.rotation.x = -Math.PI / 2; shadow.position.set(position.x - .35, -1.038, position.z - .15)
      shadow.renderOrder = 2
      scene.add(shadow); softShadows.push(shadow)
    })
    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    const bokeh = new BokehPass(scene,camera,{focus:10.1,aperture:0.0016,maxblur:0.007})
    composer.addPass(bokeh)
    composer.addPass(new OutputPass())
    const antialias = new ShaderPass(FXAAShader)
    composer.addPass(antialias)
    let flying = false
    const flyTo = (target: typeof HOME) => {
      clearInput()
      flying = true
      gsap.to(state, { ...target, duration: preferences.current.reduced ? 0 : 1.6, ease: 'power3.inOut', overwrite: true, onUpdate: () => Object.assign(targetPose, state), onComplete: () => { Object.assign(targetPose, state); flying = false } })
    }
    api.current = {
      focus: (index) => {
        const p = artworkPosition(index)
        flyTo({ x: p.x + Math.sin(p.yaw) * 9, y: 2, z: p.z + Math.cos(p.yaw) * 9, yaw: p.yaw, pitch: -.045 })
      },
      home: () => flyTo({ ...entrance }),
      stop: () => { clearInput(); gsap.killTweensOf(state); flying = false },
      light: (evening) => {
        gsap.to(ambient,{intensity:evening ? .5 : 1.85,duration:1.5})
        gsap.to(sun,{intensity:evening ? .55 : 2.7,duration:1.5})
        gsap.to(architecture.windowMaterial.color, {r:evening?.52:1,g:evening?.43:.9,b:evening?.32:.69,duration:1.5})
        const next = new THREE.Color(evening ? '#524c45' : '#d8cfbf')
        gsap.to(scene.background,{r:next.r,g:next.g,b:next.b,duration:1.5})
        gsap.to(scene.fog!.color,{r:next.r,g:next.g,b:next.b,duration:1.5})
        pools.forEach(pool => gsap.to(pool.material,{opacity:evening ? .04 : .18,duration:1.5}))
      }
    }
    const resize = () => {
      const w = element.clientWidth, h = element.clientHeight
      renderer.setSize(w, h); composer.setSize(w, h)
      antialias.uniforms.resolution.value.set(1 / (w * renderer.getPixelRatio()), 1 / (h * renderer.getPixelRatio()))
      camera.aspect = w / h; camera.fov = w < 700 ? 52 : 44
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize); observer.observe(element); resize()
    const pointer = new THREE.Vector2()
    const raycaster = new THREE.Raycaster()
    const keys = new Set<string>()
    const pointers = new Map<number, {x: number; y: number}>()
    let downPoint = {x:0,y:0}, moved = false, rotating = false, pinchDistance = 0
    const pendingDrag = { ...REST_DRAG }
    function clearInput() { keys.clear(); pointers.clear(); Object.assign(targetPose, state); Object.assign(pendingDrag, REST_DRAG); element.style.cursor = 'grab'; pinchDistance = 0 }
    const begin = () => { if (flying) Object.assign(targetPose, state); gsap.killTweensOf(state); flying = false; callbacks.current.onMove() }
    const translate = (side: number, forward: number) => {
      const next = safeMove(targetPose, travel(targetPose, side, forward, state.yaw), artworks.length)
      targetPose.x = next.x; targetPose.z = next.z
    }
    const setPointer = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect()
      pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1)
    }
    const down = (event: PointerEvent) => {
      if (preferences.current.blocked || (event.button !== 0 && event.button !== 2)) return
      element.parentElement?.focus({preventScroll:true})
      element.setPointerCapture(event.pointerId)
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY})
      downPoint = {x:event.clientX,y:event.clientY}; moved = pointers.size > 1
      rotating = event.button === 2 || event.shiftKey || preferences.current.lookMode
      if(pointers.size===2){const p=[...pointers.values()];pinchDistance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)}
      element.style.cursor = 'grabbing'
    }
    const move = (event: PointerEvent) => {
      if(preferences.current.blocked)return
      const previous = pointers.get(event.pointerId)
      if(previous){
        const dx=event.clientX-previous.x, dy=event.clientY-previous.y
        pointers.set(event.pointerId,{x:event.clientX,y:event.clientY})
        if(Math.hypot(event.clientX-downPoint.x,event.clientY-downPoint.y)>5)moved=true
        if(!moved)return
        begin()
        if(pointers.size===2){
          const p=[...pointers.values()], distance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)
          Object.assign(pendingDrag,queueDrag(pendingDrag,{side:-dx*.012,forward:(distance-pinchDistance)*.06}))
          pinchDistance=distance
        }else if(rotating){
          Object.assign(pendingDrag,queueDrag(pendingDrag,{yaw:-dx*.004,pitch:-dy*.003}))
        }else{
          Object.assign(pendingDrag,queueDrag(pendingDrag,{side:-dx*.023,forward:-dy*.038}))
        }
        return
      }
      setPointer(event);raycaster.setFromCamera(pointer,camera)
      element.style.cursor=raycaster.intersectObjects(faces).length?'pointer':'grab'
    }
    const up = (event: PointerEvent) => {
      const hadPointer=pointers.has(event.pointerId)
      pointers.delete(event.pointerId)
      if(element.hasPointerCapture(event.pointerId))element.releasePointerCapture(event.pointerId)
      if(!hadPointer)return
      if(!moved && event.button===0 && !preferences.current.blocked){setPointer(event);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(faces)[0];if(hit)callbacks.current.onSelect(hit.object.userData.index)}
      element.style.cursor='grab'
    }
    const cancel = (event: PointerEvent) => {if(!pointers.has(event.pointerId))return;pointers.delete(event.pointerId);element.style.cursor='grab'}
    const wheel = (event: WheelEvent) => {
      if(preferences.current.blocked || event.ctrlKey)return
      event.preventDefault();begin();Object.assign(pendingDrag,REST_DRAG)
      const scale=event.deltaMode===1?16:event.deltaMode===2?element.clientHeight:1
      translate(THREE.MathUtils.clamp(event.deltaX*scale,-160,160)*.016,-THREE.MathUtils.clamp(event.deltaY*scale,-160,160)*.025)
    }
    const keyDown = (event: KeyboardEvent) => {
      if(preferences.current.blocked || event.ctrlKey || event.metaKey || event.altKey)return
      if(event.target instanceof HTMLElement && event.target.closest('button,a,input,textarea,select,dialog'))return
      const key=event.key.toLowerCase()
      if(['w','a','s','d','q','e','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){event.preventDefault();keys.add(key);begin()}
    }
    const keyUp=(event:KeyboardEvent)=>keys.delete(event.key.toLowerCase())
    const context=(event:MouseEvent)=>event.preventDefault()
    element.addEventListener('pointerdown',down);element.addEventListener('pointermove',move);element.addEventListener('pointerup',up);element.addEventListener('pointercancel',cancel);element.addEventListener('lostpointercapture',cancel)
    element.addEventListener('wheel',wheel,{passive:false});element.addEventListener('contextmenu',context)
    window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',clearInput)
    const clock = new THREE.Clock()
    const direction = new THREE.Vector3(), difference = new THREE.Vector3()
    let lastReport = 0
    const render = () => {
      const dt=Math.min(clock.getDelta(),.04)
      if(!preferences.current.blocked && !flying){
        let side=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)
        let forward=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0)
        const length=Math.hypot(side,forward);if(length>0){side/=length;forward/=length;translate(side*dt*5,forward*dt*5);Object.assign(pendingDrag,REST_DRAG)}
        targetPose.yaw+=((keys.has('q')?1:0)-(keys.has('e')?1:0))*dt*1.15
        if(!dragIsQuiet(pendingDrag)){
          const coast=consumeDrag(pendingDrag,dt)
          Object.assign(pendingDrag,coast.pending)
          translate(coast.applied.side,coast.applied.forward)
          targetPose.yaw+=coast.applied.yaw
          targetPose.pitch=THREE.MathUtils.clamp(targetPose.pitch+coast.applied.pitch,-.7,.55)
        }
        const damped = dampCamera(state, targetPose, dt, preferences.current.reduced)
        const safe = safeMove(state, damped, artworks.length)
        Object.assign(state, damped, safe)
      }
      camera.position.set(state.x,state.y,state.z);camera.rotation.set(state.pitch,state.yaw,0);camera.updateMatrixWorld()
      camera.getWorldDirection(direction)
      let focusDistance=12, score=Infinity, nearest: number | null = null
      panels.forEach((panel,index)=>{difference.subVectors(panel.position,camera.position);const depth=difference.dot(direction);if(depth>.7){const offset=difference.clone().addScaledVector(direction,-depth).length();const candidate=offset*3+depth*.12;if(candidate<score){score=candidate;focusDistance=depth;nearest=index}}})
      const uniforms=bokeh.uniforms as Record<string, THREE.IUniform>
      uniforms.focus.value=THREE.MathUtils.lerp(uniforms.focus.value,Math.min(35,focusDistance),1-Math.exp(-5*dt))
      if(performance.now()-lastReport>100){callbacks.current.onPosition({x:state.x,z:state.z,yaw:state.yaw,nearest:!preferences.current.blocked&&!flying?nearest:null});lastReport=performance.now()}
      composer.render()
    }
    renderer.setAnimationLoop(render)
    const visibility = () => {clearInput();clock.getDelta();renderer.setAnimationLoop(document.hidden ? null : render)}
    document.addEventListener('visibilitychange',visibility)
    return () => {
      disposed=true;clearTimeout(loadingTimeout);api.current=null;observer.disconnect();renderer.setAnimationLoop(null)
      document.removeEventListener('visibilitychange',visibility)
      element.removeEventListener('pointermove',move);element.removeEventListener('pointerdown',down);element.removeEventListener('pointerup',up);element.removeEventListener('pointercancel',cancel);element.removeEventListener('lostpointercapture',cancel)
      element.removeEventListener('wheel',wheel);element.removeEventListener('contextmenu',context)
      window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',clearInput)
      gsap.killTweensOf([state,ambient,sun,architecture.windowMaterial.color,scene.background,scene.fog!.color,...pools.map(p=>p.material),...panels.flatMap(p=>[p.position,p.rotation]),...softShadows.map(s=>s.position)])
      scene.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(m=>m.dispose())}})
      architecture.dispose();textures.forEach(t=>t.dispose());lightTexture.dispose();shadowTexture.dispose();antialias.dispose();bokeh.dispose();composer.dispose();renderer.dispose();renderer.domElement.remove()
    }
  },[])
  useEffect(()=>{if(focus.nonce)api.current?.focus(focus.index)},[focus])
  useEffect(()=>{if(home)api.current?.home()},[home])
  useEffect(()=>{if(blocked)api.current?.stop()},[blocked])
  useEffect(()=>{api.current?.light(dusk)},[dusk,reduced])
  return <div className={`scene ${fallback ? 'scene-fallback' : ''}`} ref={host} aria-hidden="true">{fallback && <><img className="fallback-left" src={artworks[wrap(active-1)].image} alt=""/><img className="fallback-main" src={artworks[active].image} alt=""/><img className="fallback-right" src={artworks[wrap(active+1)].image} alt=""/></>}</div>
}
