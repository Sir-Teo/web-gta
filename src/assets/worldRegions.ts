/** Bounded native-content regions verified against the public world archive.
 * These are content selection presets, not full-world streaming boundaries. */
export interface WorldRegion { id:string; name:string; district:string; x:number; y:number; radius:number; neighbors?:readonly string[]; includeCollisionBounds?:boolean; }
export const WORLD_REGIONS:readonly WorldRegion[]=[
  {id:'mount-chiliad',name:'Mount Chiliad terrain',district:'country/countryS',x:-2320,y:-1620,radius:400},
  {id:'verdant-meadows',name:'Verdant Meadows desert',district:'country/countn2',x:400,y:2500,radius:300},
  {id:'doherty',name:'Doherty San Fierro',district:'SF/SFSe',x:-2020,y:-100,radius:160},
  {id:'las-venturas',name:'Las Venturas sample',district:'vegas/vegasE',x:2020,y:1500,radius:160},
  {id:'chiliad-east',name:'Mount Chiliad eastern countryside',district:'country/countryS',neighbors:['country/countryw'],x:-1750,y:-1450,radius:450,includeCollisionBounds:true},
];
