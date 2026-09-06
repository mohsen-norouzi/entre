import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowUpRight, ArrowRight, ArrowLeft, X, Sun, Moon, Grid2X2, Maximize2, Pause, Play, Move, Eye, RotateCcw } from 'lucide-react'
import gsap from 'gsap'
import GalleryScene from './GalleryScene'
import { artworks, wrap } from './artworks'
import { artworkPosition, HOME, ROOM } from './navigation'
import './styles.css'

type Panel = 'index' | 'about' | 'work' | null
function App() {
  const [active, setActive] = useState(0)
  const [exploring, setExploring] = useState(false)
  const [lookMode, setLookMode] = useState(false)
  const [focus, setFocus] = useState({index:0,nonce:0})
  const [home, setHome] = useState(0)
  const [position, setPosition] = useState({x:HOME.x,z:HOME.z,yaw:HOME.yaw})
  const [panel, setPanel] = useState<Panel>(null)
  const [dusk, setDusk] = useState(false)
  const [ready, setReady] = useState(false)
  const [reduced, setReduced] = useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const dialog = useRef<HTMLDialogElement>(null)
  const caption = useRef<HTMLDivElement>(null)
  const page = useRef<HTMLDivElement>(null)
  const art = artworks[active]
  const goTo = (index: number) => {setActive(index);setFocus(current=>({index,nonce:current.nonce+1}));setExploring(true);setPanel(null)}
  const resetView = () => {setHome(current=>current+1);setActive(0);setExploring(false);setPanel(null);setLookMode(false)}
  const step = (direction: number) => goTo(wrap(active+direction))
  useEffect(()=>{
    if(!ready || reduced) return
    const ctx=gsap.context(()=>{gsap.from('.intro-reveal',{y:22,opacity:0,duration:1.3,stagger:.1,ease:'power3.out',clearProps:'all'})},page)
    return ()=>ctx.revert()
  },[ready,reduced])
  useEffect(()=>{
    if(reduced)return
    const ctx=gsap.context(()=>{gsap.fromTo(caption.current,{opacity:0,y:10},{opacity:1,y:0,duration:.8,delay:.35})})
    return ()=>ctx.revert()
  },[active,reduced])
  useEffect(()=>{
    if(panel){dialog.current?.showModal()}else{dialog.current?.close()}
  },[panel])
  const select=(index:number)=>{setActive(index);setPanel('work')}
  return <div className={`gallery ${dusk?'is-dusk':''} ${ready?'is-ready':''} ${exploring?'is-exploring':''}`} ref={page}>
    <a className="skip-link" href="#gallery-controls">Skip to gallery controls</a>
    <main className="gallery-main" tabIndex={-1} aria-label="Free-roaming art gallery">
      <GalleryScene key={artworks.length} active={active} focus={focus} home={home} dusk={dusk} reduced={reduced} blocked={panel!==null} lookMode={lookMode} onSelect={select} onReady={()=>setReady(true)} onMove={()=>setExploring(true)} onPosition={p=>{setPosition(p);if(exploring && !panel && p.nearest!==null)setActive(p.nearest)}}/>
      <div className="atmosphere"/>
      <div className="grain"/>
      <header className="header intro-reveal flex items-center justify-between">
        <button className="wordmark" onClick={resetView} aria-label="ENTRE, return to first work">ENTRE<span className="wordmark-dot">.</span></button>
        <nav className="desktop-nav flex items-center" aria-label="Main navigation">
          <button className={!panel?'nav-link current':'nav-link'} onClick={()=>setPanel(null)}>Exhibition</button>
          <button className={panel==='index'?'nav-link current':'nav-link'} onClick={()=>setPanel('index')}>The collection <span className="nav-count">{artworks.length}</span></button>
          <button className={panel==='about'?'nav-link current':'nav-link'} onClick={()=>setPanel('about')}>About</button>
        </nav>
        <div className="header-right flex items-center"><span className="edition-label">An independent<br/>space for art</span><button className="icon-button light-toggle" aria-label={dusk?'Switch to daylight':'Switch to evening light'} title={dusk?'Daylight':'Evening light'} onClick={()=>setDusk(v=>!v)}>{dusk?<Moon size={18}/>:<Sun size={20}/>}</button><button className="icon-button mobile-menu" onClick={()=>setPanel('index')} aria-label="Open collection"><Grid2X2 size={19}/></button></div>
      </header>
      <section className="intro" aria-labelledby="exhibition-title" inert={exploring}>
        <div className="eyebrow intro-reveal"><span className="tiny-line"/> A study in stillness</div>
        <h1 className="intro-reveal" id="exhibition-title">A quieter<br/>way of<br/><em>seeing.</em></h1>
        <p className="intro-copy intro-reveal">The familiar, held in a different light.<br/>Twenty moments. Room to wander.</p>
        <button className="explore-button intro-reveal group flex items-center" onClick={()=>setExploring(true)}><span className="round-arrow"><ArrowUpRight size={20} strokeWidth={1}/></span><span>Enter the gallery</span></button>
      </section>
      <aside className="room-tools" aria-label="Movement controls">
        <div className="movement-toggle"><button className={!lookMode?'chosen':''} aria-pressed={!lookMode} onClick={()=>setLookMode(false)} title="Drag to move through the room"><Move size={15}/><span>Move</span></button><button className={lookMode?'chosen':''} aria-pressed={lookMode} onClick={()=>setLookMode(true)} title="Drag to turn the camera"><Eye size={16}/><span>Look</span></button></div>
        <button className="reset-view" onClick={resetView} title="Return to the entrance"><RotateCcw size={14}/><span>Reset view</span></button>
      </aside>
      <aside className="room-map" aria-label="Gallery map"><div className="map-title"><span>The space</span><span>{artworks.length} works</span></div><div className="map-floor">{artworks.map((item,i)=>{const p=artworkPosition(i);return <button key={item.id} className={`map-art ${i===active?'map-selected':''}`} style={{left:`${(p.x-ROOM.minX)/(ROOM.maxX-ROOM.minX)*100}%`,top:`${(p.z-ROOM.minZ)/(ROOM.maxZ-ROOM.minZ)*100}%`}} onClick={()=>goTo(i)} aria-label={`Go to ${item.id}: ${item.title}`} title={`${item.id} — ${item.title}`}>{item.id}</button>})}<span className="map-position" style={{left:`${(position.x-ROOM.minX)/(ROOM.maxX-ROOM.minX)*100}%`,top:`${(position.z-ROOM.minZ)/(ROOM.maxZ-ROOM.minZ)*100}%`,transform:`translate(-50%,-50%) rotate(${-position.yaw}rad)`}} aria-hidden="true"/></div><p><span/> You are here <span className="map-entry">Entrance</span></p></aside>
      <div className="art-caption" ref={caption} aria-live="polite" aria-atomic="true"><span className="caption-number">{art.id}</span><div><h2>{art.title}</h2><p>{art.category} <span>—</span> {art.year}</p></div><button className="caption-open icon-button" onClick={()=>setPanel('work')} aria-label={`View ${art.title}`}><Maximize2 size={15}/></button></div>
      <footer className="footer intro-reveal flex items-center justify-between" id="gallery-controls">
        <div className="gesture-hint flex items-center"><span className="gesture-line"/><p>Drag to move · Scroll to travel<br/><span>Shift + drag to look · WASD to walk</span></p></div>
        <div className="exhibition-label"><span className="live-dot"/> TAKE YOUR TIME. THERE IS NO SET PATH.</div>
        <div className="footer-controls flex items-center"><button className="motion-control icon-button" onClick={()=>setReduced(v=>!v)} aria-label={reduced?'Enable gentle motion':'Reduce motion'} title={reduced?'Enable gentle motion':'Reduce motion'}>{reduced?<Play size={13}/>:<Pause size={13}/>}</button><span className="page-count"><strong>{art.id}</strong><span>/</span>{artworks.length}</span><button className="icon-button" onClick={()=>step(-1)} aria-label="Previous artwork"><ArrowLeft size={21} strokeWidth={1}/></button><button className="icon-button" onClick={()=>step(1)} aria-label="Next artwork"><ArrowRight size={21} strokeWidth={1}/></button></div>
      </footer>
      {!ready&&<div className="loading-screen" role="status"><span className="wordmark">ENTRE.</span><span className="loading-line"/><p>Finding the light</p></div>}
    </main>
    <dialog ref={dialog} className={`gallery-dialog dialog-${panel}`} onCancel={()=>setPanel(null)} onClick={e=>{if(e.target===e.currentTarget)setPanel(null)}}>
      <div className="dialog-inner"><div className="dialog-top flex justify-between items-center"><span className="eyebrow">ENTRE. <span className="dialog-top-label">/ {panel==='work'?'A closer look':panel==='index'?'The collection':'About this space'}</span></span><button className="icon-button close-button" aria-label="Close dialog" onClick={()=>setPanel(null)}><X size={23} strokeWidth={1}/></button></div>
      {panel==='index'&&<section className="collection"><div className="collection-heading"><h2>Studies in <em>stillness.</em></h2><p>Twenty works. A space to get lost in.</p></div><div className="collection-grid">{artworks.map((item,i)=><button className="collection-card" key={item.id} onClick={()=>goTo(i)}><div className="collection-image"><img src={item.image} alt={item.title} loading="lazy"/><span className="collection-enter"><ArrowUpRight size={25} strokeWidth={1}/></span></div><div className="collection-meta"><span>{item.id}</span><div><h3>{item.title}</h3><p>{item.category}</p></div><span>{item.year}</span></div></button>)}</div></section>}
      {panel==='work'&&<article className="work-detail"><div className="detail-image"><img src={art.image} alt={`${art.title} — ${art.note}`}/></div><div className="detail-copy"><span className="eyebrow">Study {art.id} / {artworks.length}</span><h2>{art.title}</h2><p className="detail-description">{art.description}</p><dl><div><dt>Series</dt><dd>Studies in stillness</dd></div><div><dt>Medium</dt><dd>Digital artwork</dd></div><div><dt>Palette</dt><dd>{art.palette}</dd></div><div><dt>Year</dt><dd>{art.year}</dd></div></dl><p className="detail-note">{art.note}</p><div className="detail-next"><button onClick={()=>setActive(wrap(active-1))} className="icon-button" aria-label="View previous work"><ArrowLeft size={20}/></button><button onClick={()=>setActive(wrap(active+1))}>Next study <ArrowRight size={19}/></button></div></div></article>}
      {panel==='about'&&<section className="about-content"><span className="eyebrow">The art of paying attention</span><h2>Some things ask<br/>us to <em>slow down.</em></h2><div className="about-columns"><p>Entre means “between.” Between light and shadow. Between an object and the feeling it leaves behind.</p><div><p>Twenty digital studies of the everyday share this open room. Flowers and stone, paper and water, the fleeting shapes left by light. Wander between them and find your own connections.</p><p>There is no right way to move through the room. Take your time. Look a little closer.</p><button className="text-link" onClick={()=>setPanel(null)}>Return to the exhibition <ArrowUpRight size={18}/></button></div></div><div className="about-foot">STUDIES IN STILLNESS <span>EST. 2026</span></div></section>}
      </div>
    </dialog>
  </div>
}
createRoot(document.getElementById('root')!).render(<App/> )
