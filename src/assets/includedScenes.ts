/** Same-origin native packages available in the published game. */
export const INCLUDED_SCENES=[
 {id:'verdant-meadows',name:'Verdant Meadows',location:'Bone County, San Andreas',file:'verdant.scene.bin',datasetIdentity:'pages-verdant-v2',spawn:{x:400,z:-2500}},
 {id:'grove-street',name:'Grove Street',location:'Ganton, Los Santos',file:'grove.scene.bin',datasetIdentity:'pages-grove-v1',spawn:{x:2495,z:1687}},
] as const;
export function includedScene(id:string|null){return INCLUDED_SCENES.find(scene=>scene.id===id)??INCLUDED_SCENES[0];}
