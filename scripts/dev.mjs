import { spawn } from 'node:child_process';
// Sites preview passes Vite-style options. Translate them for Next.js.
const args=process.argv.slice(2);
const read=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const port=read('--port','3000');
if(!/^\d{2,5}$/.test(port))throw new Error('Invalid preview port');
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','0.0.0.0','--port',port],{stdio:'inherit'});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??0));
