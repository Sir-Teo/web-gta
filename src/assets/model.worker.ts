import {readRegionPaths} from './regionPaths';
import {readRegionRoute} from './regionRoute';
import { readAnimation } from './readAnimation';
import { readPlacements } from './readPlacements';
import { readModel } from './readModel';
import { readScene } from './scene';
import { matchingPlacements } from './ipl';
import { readIdeAssociations, mergeIdeAssociations, readIdeParents, mergeIdeParents } from './ide';
import { readImgIndex } from './img';
import {prepareWorldFolder} from './worldFolder';
let folderPlanner:Awaited<ReturnType<typeof prepareWorldFolder>>|undefined;
import {readPlayerFiles} from './readPlayerFiles';
self.onmessage = async ({ data }) => {
  try {
    if(data.action==='route'){const route=await readRegionRoute(data.file,data.region,data.destination);self.postMessage({route},{transfer:[route.positions.buffer]});return;}
    if(data.action==='paths'){const paths=await readRegionPaths(data.file,data.region);self.postMessage({paths},{transfer:[paths.land.buffer,paths.pedestrian.buffer,paths.water.buffer,paths.oneWay.buffer,paths.signals.buffer,paths.signalGroups.buffer]});return;}
    if(data.action==='player'){
      const result=await readPlayerFiles(data.files,data.variant,data.outfit),transfer=new Set<ArrayBuffer>();
      for(const g of result.model.geometries)for(const a of [g.positions,g.normals,g.colors,g.nightColors,g.indices,g.materialIds,g.skin?.indices,g.skin?.weights,g.skin?.inverseMatrices,g.skin?.usedBones,...g.uvs])if(a)transfer.add(a.buffer as ArrayBuffer);
      for(const t of result.textures)for(const mip of t.mips)transfer.add(mip.data.buffer as ArrayBuffer);
      self.postMessage(result,{transfer:[...transfer]});return;
    }
    if (data.action === 'animation') {
      const result = await readAnimation(data), transfer: ArrayBuffer[] = [];
      for (const clip of result.animation.animations) for (const track of clip.tracks) {
        for (const buffer of [track.times, track.rotations, track.translations]) if (buffer) transfer.push(buffer.buffer as ArrayBuffer);
      }
      self.postMessage(result, { transfer }); return;
    }
    if (data.action === 'scene' || data.action === 'world-folder' || data.action==='world-folder-region') {
      if(data.action==='world-folder'){folderPlanner=undefined;folderPlanner=await prepareWorldFolder(data.files);}
      if(data.action==='world-folder-region'&&!folderPlanner)throw new Error('Select the content folder again.');
      const request=data.action==='scene'?data:await folderPlanner!.plan(data.regionId,data.region,data.discoverDistricts);
      const result = {...await readScene(request),folderIndexBuilds:folderPlanner?.indexBuilds,environment:request.environment,sourceDistricts:request.sourceDistricts,pathSource:request.interior===0&&request.region?{file:request.file,region:request.region}:undefined}, transfer = new Set<ArrayBuffer>();
      for (const part of result.scene) {
        for (const g of part.model.geometries) for (const a of [g.positions, g.normals, g.colors, g.nightColors, g.indices, g.materialIds, g.skin?.indices, g.skin?.weights, g.skin?.inverseMatrices, g.skin?.usedBones, ...g.uvs]) if (a) transfer.add(a.buffer as ArrayBuffer);
        for (const t of part.textures) for (const mip of t.mips) transfer.add(mip.data.buffer as ArrayBuffer);
      }
      self.postMessage(result, { transfer: [...transfer] }); return;
    }
    if (data.action === 'ide') {
      const files: File[] = data.files;
      if (files.length > 100 || files.reduce((size, file) => size + file.size, 0) > 4 * 1024 * 1024) throw new Error('IDE selection exceeds 100 files or 4 MiB.');
      const records = [], parentRecords: [string, string][] = [];
      for (const file of files) {
        const text = new TextDecoder('windows-1252').decode(await file.arrayBuffer());
        records.push(...readIdeAssociations(text)); parentRecords.push(...readIdeParents(text));
      }
      self.postMessage({ associations: [...mergeIdeAssociations(records)], parents: [...mergeIdeParents(parentRecords)] }); return;
    }
    const file: File = data.file;
    if (data.action === 'index') { self.postMessage({ entries: await readImgIndex(file) }); return; }
    const { model, textures, dictionaryNames, notices, collision, collisionSource } = await readModel(data);
    let placements;
    let placementSource;
    if (data.placementFile || data.placementEntry) {
      const source = await readPlacements(data), ipl = source.ipl; placementSource = source.name;
      const modelName = (data.entry?.name ?? file.name).replace(/\.dff$/i, '');
      placements = matchingPlacements(ipl, modelName, data.modelId, data.interior);
      if (!placements.length) throw new Error(`No placements for ${modelName} in interior ${data.interior}.`);
      notices.push(...ipl.warnings, 'Only this model is placed. LOD links are retained but not resolved.');
    }
    const buffers = new Set<ArrayBuffer>();
    for (const g of model.geometries) for (const a of [g.positions, g.normals, g.colors, g.nightColors, g.indices, g.materialIds, g.skin?.indices, g.skin?.weights, g.skin?.inverseMatrices, g.skin?.usedBones, ...g.uvs]) if (a) buffers.add(a.buffer as ArrayBuffer);
    for (const t of textures) for (const mip of t.mips) buffers.add(mip.data.buffer as ArrayBuffer);
    self.postMessage({ model, textures, dictionaryNames, notices, placements, placementSource, collision, collisionSource }, { transfer: [...buffers] });
  } catch (error) { self.postMessage({ folderReady:!!folderPlanner,error: error instanceof Error ? error.message : 'Could not read the model.' }); }
};
