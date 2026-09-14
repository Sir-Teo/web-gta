import {expect,test} from 'vitest';
import {openAsBlob} from 'node:fs';
import {readImgIndex,readImgEntry} from '../src/assets/img';
import {readPathNodes,type PathArea} from '../src/assets/pathNodes';
const root=process.env.GTA_CONTENT_DIR;
test.skipIf(!root)('native exterior path graph resolves every active destination and road navigation link',async()=>{
 const archive=await openAsBlob(root+'/gta3.img'),areas=new Map<number,PathArea>();
 for(const entry of await readImgIndex(archive)){
  const match=/^nodes(\d+)\.dat$/i.exec(entry.name);if(!match)continue;
  const area=Number(match[1]);expect(areas.has(area)).toBe(false);areas.set(area,readPathNodes(await readImgEntry(archive,entry),area));
 }
 expect(areas.size).toBe(64);let nodes=0,navigation=0,edges=0,crossArea=0;
 for(const area of areas.values()){
  nodes+=area.nodes.length;navigation+=area.navigation.length;
  for(const node of area.nodes)for(let i=0;i<node.linkCount;i++){
   const link=area.links[node.baseLink+i];expect(areas.get(link.area)?.nodes[link.node]?.address).toEqual(link);edges++;crossArea+=Number(link.area!==area.area);
   if(node.kind==='vehicle'&&!node.water){const navi=area.navigationLinks[node.baseLink+i];expect(navi).not.toBeNull();expect(areas.get(navi!.area)?.navigation[navi!.node]).toBeDefined();}
  }
  for(const navi of area.navigation)expect(areas.get(navi.attachedTo.area)?.nodes[navi.attachedTo.node]?.address).toEqual(navi.attachedTo);
 }
 expect({nodes,navigation,edges,crossArea}).toEqual({nodes:68237,navigation:31466,edges:143622,crossArea:2424});
},20000);
