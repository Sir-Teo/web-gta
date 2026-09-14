/** One continuous San Andreas world; the package only bootstraps its first streaming window. */
export const INCLUDED_SCENES=[
 {id:'san-andreas',name:'San Andreas',location:'Grove Street · San Andreas',file:'world-start.scene.bin',datasetIdentity:'pages-grove-v1',spawn:{x:2495,z:1687}},
] as const;
export function includedScene(_id:string|null){return INCLUDED_SCENES[0];}
