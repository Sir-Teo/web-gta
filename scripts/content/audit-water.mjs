/** Export acquired water topology for inspection; no invented water planes or wave pixels. */
import {readFile,writeFile,mkdtemp,rm,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';import {tmpdir} from 'node:os';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';import {build} from 'rolldown';
if(!process.argv[2])throw new Error('Usage: node scripts/content/audit-water.mjs /absolute/content-directory');
const root=resolve(process.argv[2]),temp=await mkdtemp(join(tmpdir(),'water-content-'));
try{
 await build({input:resolve('src/assets/water.ts'),platform:'node',output:{file:join(temp,'water.mjs'),format:'esm'}});
 const {readWater,waterGeometry,waterProperties,visibleWaterPolygons}=await import(pathToFileURL(join(temp,'water.mjs'))),source=await readFile(join(root,'water.dat')),water=readWater(source.toString()),mesh=waterGeometry(water.polygons);
 const heights=water.polygons.flatMap(p=>p.vertices.map(v=>v.position[2]));
 const report={source:join(root,'water.dat'),sha256:createHash('sha256').update(source).digest('hex'),bytes:source.length,processed:water.processed,polygons:water.polygons.length,triangles:water.polygons.filter(p=>p.vertices.length===3).length,quads:water.polygons.filter(p=>p.vertices.length===4).length,renderTriangles:mesh.indices.length/3,vertices:mesh.positions.length/3,heightRange:[Math.min(...heights),Math.max(...heights)],flags:Object.fromEntries([...new Set(mesh.flags)].map(flag=>[flag,mesh.flags.filter(f=>f===flag).length])),visibility:{exterior:visibleWaterPolygons(water.polygons,false).length,interior:visibleWaterPolygons(water.polygons,true).length,invisible:water.polygons.filter(p=>!waterProperties(p).visible).length,limitedDepth:water.polygons.filter(p=>waterProperties(p).limitedDepth).length},data:water.polygons};
 await mkdir(join(root,'water-inspection'),{recursive:true});await writeFile(join(root,'water-inspection/water.json'),JSON.stringify(report,null,2));
 let obj='# Static water topology; browser Y-up. Flags and wave/flow data are in water.json.\n';
 for(let i=0;i<mesh.positions.length;i+=3)obj+=`v ${mesh.positions[i]} ${mesh.positions[i+1]} ${mesh.positions[i+2]}\n`;
 for(let i=0;i<mesh.indices.length;i+=3)obj+=`f ${mesh.indices[i]+1} ${mesh.indices[i+1]+1} ${mesh.indices[i+2]+1}\n`;
 await writeFile(join(root,'water-inspection/water.obj'),obj);
 for(const [label,interior]of [['exterior',false],['interior',true]]){
   const selected=visibleWaterPolygons(water.polygons,interior),geometry=waterGeometry(selected);let text=`# Visible ${label} static water; Y-up; no waves or materials.\n`;
   for(let i=0;i<geometry.positions.length;i+=3)text+=`v ${geometry.positions[i]} ${geometry.positions[i+1]} ${geometry.positions[i+2]}\n`;
   for(let i=0;i<geometry.indices.length;i+=3)text+=`f ${geometry.indices[i]+1} ${geometry.indices[i+1]+1} ${geometry.indices[i+2]+1}\n`;
   await writeFile(join(root,`water-inspection/water-${label}.obj`),text);
 }

 const polygons=water.polygons.map(p=>{const order=p.vertices.length===4?[0,1,3,2]:[0,1,2],high=p.vertices.some(v=>Math.abs(v.position[2])>1);return `<polygon points="${order.map(i=>`${p.vertices[i].position[0]},${-p.vertices[i].position[1]}`).join(' ')}" fill="${high?'#eba54e':'#278ab1'}" fill-opacity=".7" stroke="#b3e4f5" stroke-width="3"><title>Line ${p.line}; flags ${p.flags}; heights ${p.vertices.map(v=>v.position[2]).join(', ')}</title></polygon>`;}).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="850" viewBox="0 0 800 850"><rect width="800" height="850" fill="#17212b"/><text x="24" y="30" fill="white" font-family="sans-serif" font-size="20">San Andreas — acquired water polygons</text><text x="24" y="55" fill="#b2c7d6" font-family="sans-serif" font-size="13">Blue: near sea level · Amber: other elevations · Background: unclassified</text><svg x="20" y="70" width="760" height="760" viewBox="-3200 -3200 6400 6400">${polygons}</svg></svg>`;
 await writeFile(join(root,'water-inspection/water.svg'),svg);

 const {data,...summary}=report;console.log(JSON.stringify(summary,null,2));
}finally{await rm(temp,{recursive:true,force:true});}
