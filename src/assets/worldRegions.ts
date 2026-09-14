/** Bounded native-content regions verified against the public world archive.
 * These are content selection presets, not full-world streaming boundaries. */
export interface WorldRegion { id:string; name:string; district:string; x:number; y:number; radius:number; neighbors?:readonly string[]; includeCollisionBounds?:boolean; }
export const WORLD_REGIONS:readonly WorldRegion[]=[
  {id:'grove-street',name:'Grove Street and Ganton',district:'LA/LAe2',neighbors:['LA/LAs2'],x:2495,y:-1687,radius:180,includeCollisionBounds:true},
  {id:'mount-chiliad',name:'Mount Chiliad terrain',district:'country/countryS',neighbors:['country/countryw','leveldes/seabed','SF/SFSe'],x:-2320,y:-1620,radius:400,includeCollisionBounds:true},
  {id:'verdant-meadows',name:'Verdant Meadows desert',district:'country/countn2',x:400,y:2500,radius:300,includeCollisionBounds:true},
  {id:'doherty',name:'Doherty San Fierro',district:'SF/SFSe',x:-2020,y:-100,radius:160,includeCollisionBounds:true},
  {id:'las-venturas',name:'Las Venturas sample',district:'vegas/vegasE',neighbors:['vegas/vegaxref'],x:2020,y:1500,radius:160,includeCollisionBounds:true},
  {id:'chiliad-east',name:'Mount Chiliad eastern countryside',district:'country/countryS',neighbors:['country/countryw','leveldes/seabed','SF/SFSe'],x:-1750,y:-1450,radius:450,includeCollisionBounds:true},
  {id:'gant-bridge',name:'Gant Bridge and northern approach',district:'SF/SFw',neighbors:['SF/SFn','leveldes/seabed'],x:-2681.5,y:1850,radius:550,includeCollisionBounds:true},
  {id:'santa-maria',name:'Santa Maria Beach and pier',district:'LA/LAw2',neighbors:['LA/LAw','leveldes/seabed','LA/LAs'],x:600,y:-1900,radius:400,includeCollisionBounds:true},
  {id:'sherman-dam',name:'Sherman Dam and reservoir terrain',district:'country/countryN',neighbors:['country/countn2','leveldes/seabed'],x:-715,y:2050,radius:350,includeCollisionBounds:true},
];
