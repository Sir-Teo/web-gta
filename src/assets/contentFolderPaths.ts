import {requireAsset} from './binary';
export interface WorldFolderFile {path:string;file:File;}
/** Explicit relative paths survive structured cloning, unlike webkitRelativePath. */
export function indexContentFolderPaths(files:readonly WorldFolderFile[]){
 requireAsset(files.length>0&&files.length<=10000,'Content folder requires 1–10,000 files.');
 const byPath=new Map<string,File>();let root:string|undefined;
 for(const {path,file} of files){
  const segments=path.replace(/\\/g,'/').split('/');
  requireAsset(segments.length>=2&&segments.every(s=>s&&s!=='.'&&s!=='..'),'Invalid content folder path.');
  root??=segments[0];requireAsset(root===segments[0],'Select one content folder.');
  const relative=segments.slice(1).join('/').toLowerCase();
  requireAsset(!byPath.has(relative),`Duplicate content path: ${relative}.`);byPath.set(relative,file);
 }
 return byPath;
}
