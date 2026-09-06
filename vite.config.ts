import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({server:{host:'127.0.0.1',port:5173,strictPort:true,watch:{usePolling:true,interval:250}},plugins:[react(),tailwindcss()],build:{rollupOptions:{output:{manualChunks:{three:['three','three/addons/postprocessing/EffectComposer.js','three/addons/postprocessing/RenderPass.js','three/addons/postprocessing/BokehPass.js','three/addons/postprocessing/OutputPass.js'],motion:['gsap']}}}}})
