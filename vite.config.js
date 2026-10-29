import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { localizationPlugin } from './scripts/localize-jsx.mjs';

export default defineConfig({
  plugins: [localizationPlugin(), react(), {name:'isolated-layout-fixture',configureServer(server){server.middlewares.use((request,response,next)=>{const url=new URL(request.url,'http://localhost');if(url.searchParams.get('mobileFixture')==='1'){url.searchParams.set('route',url.pathname);request.url='/scripts/mobile-fixture.html'+url.search;}next();});}}],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return;
          if (id.includes('/@supabase/')) return 'cloud-client';
          if (/\/(recharts|recharts-scale|d3-[^/]+|victory-vendor)\//.test(id)) return 'charts';
          if (/\/(react|react-dom|scheduler)\//.test(id)) return 'react-runtime';
        },
      },
    },
  },
});
