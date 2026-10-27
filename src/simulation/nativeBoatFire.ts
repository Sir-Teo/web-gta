type Point=Readonly<[number,number,number]>;
/** CBoat::ProcessControl (PC 0x6F1770): native XY camera square; altitude does not gate burning. */
export function boatFireControl(health:number,wrecked:boolean,position:Point,camera:Point){
 const f=Math.fround,reset=wrecked||f(health)>460;
 return {reset,burning:!reset&&f(health)<250&&Math.abs(f(f(position[0])-f(camera[0])))<200&&Math.abs(f(f(position[1])-f(camera[1])))<200};
}
/** PC CBoat fire offsets, not model engine dummies. The selected iOS executable adds one unit to Z. */
export function boatFirePosition(model:number):[number,number,number]{
 const f=Math.fround;return model===452?[f(.4),f(-2.4),f(.8)]:model===453?[2,-1,.5]:[-1.5,-.5,f(1.2)];
}
