// Loads the game's TypeScript modules from a plain Node script through Vite's module runner, so the pipeline reads
// the decoder, opcode tables and handler maps the game itself runs rather than a copy of them.
import {createServer} from 'vite';
export async function withSources(run){
 const server=await createServer({configFile:false,root:process.cwd(),logLevel:'error',server:{middlewareMode:true,hmr:false,ws:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try{return await run(path=>server.ssrLoadModule(path));}finally{await server.close();}
}
