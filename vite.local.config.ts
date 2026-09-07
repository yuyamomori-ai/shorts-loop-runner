import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';
export default defineConfig({root:'local-ui',plugins:[react()],resolve:{alias:{'@':resolve('.')}},publicDir:resolve('public'),build:{outDir:resolve('local-dist'),emptyOutDir:true}});
