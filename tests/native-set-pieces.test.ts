import {expect,test} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {NativeSetPieces,type SetPieceWorld} from '../src/simulation/nativeSetPieces';
import {SET_PIECE,readInitialSetPieces,type ScmSetPiece} from '../src/assets/scmSetPieces';

const piece=(type:number):ScmSetPiece=>({type,area:[0,0,100,100],spawn1:[10,10],target1:[20,20],spawn2:[30,30],target2:[40,40]});
const world=(over:Partial<SetPieceWorld>={}):SetPieceWorld=>({player:[50,50,10],playerSpeed:[0,0],wanted:1,inVehicle:false,timeMs:10000,...over});
/** Runs all eight frame slices once. */
const all=(s:NativeSetPieces,w:SetPieceWorld)=>Array.from({length:8},(_,f)=>s.update(f,w)).flat();

test('CSetPiece::Update generates by type, wanted level and vehicle, inside the area only', () => {
 const s=new NativeSetPieces([piece(SET_PIECE.twoCarsSlow),piece(SET_PIECE.twoPeds),piece(SET_PIECE.oneCarMedium),piece(SET_PIECE.twoCarsMedium)]);
 // One star on foot: the slow cars (cruise 4) and the two cops; the medium pair (cruise 24) too.
 const r=all(s,world());
 expect(r.map(x=>[x.piece,x.kind,x.together])).toEqual([[0,'cars',true],[1,'cops',true],[3,'cars',true]]);
 expect(r[0].kind==='cars'&&r[0].cars.map(c=>[c.mission,c.cruise,c.timeNeeded,c.quick])).toEqual([['slowlyDriveTowardsPlayer',4,25000,false],['slowlyDriveTowardsPlayer',4,25000,false]]);
 // Pending pieces wait for the host; a success holds them 4 s.
 expect(all(s,world())).toEqual([]);
 s.generated(0,true,10000);s.generated(1,false,10000);
 expect(all(s,world({timeMs:13999})).map(x=>x.piece)).toEqual([1]);
 expect(all(s,world({timeMs:14001})).map(x=>x.piece)).toEqual([0]);
 // Outside the area, nothing.
 expect(all(new NativeSetPieces([piece(SET_PIECE.twoPeds)]),world({player:[150,50,10]}))).toEqual([]);
});

test('quick cars need two stars in a vehicle heading toward their spawn point', () => {
 const s=()=>new NativeSetPieces([piece(SET_PIECE.oneCarQuick)]);
 expect(all(s(),world({wanted:2,inVehicle:true,playerSpeed:[1,1]}))).toEqual([]);
 const r=all(s(),world({wanted:2,inVehicle:true,playerSpeed:[-1,-1]}));
 expect(r[0].kind==='cars'&&r[0].cars[0]).toMatchObject({mission:'blockPlayerForwardAndBack',cruise:16,timeNeeded:10000,quick:true});
 expect(all(s(),world({wanted:1,inVehicle:true,playerSpeed:[-1,-1]}))).toEqual([]);
 // Cops on foot need a star and no vehicle.
 expect(all(new NativeSetPieces([piece(SET_PIECE.onePed)]),world({wanted:0}))).toEqual([]);
 expect(all(new NativeSetPieces([piece(SET_PIECE.onePed)]),world({wanted:1,inVehicle:true}))).toEqual([]);
});

test('CSetPieces::Update checks an eighth of the pieces each frame', () => {
 const s=new NativeSetPieces(Array.from({length:16},()=>piece(SET_PIECE.onePed)));
 expect(s.update(3,world()).map(x=>x.piece)).toEqual([6,7]);
});

const scm='/Users/teo/Developer/web-gta-content/scripts/main.scm';
test.skipIf(!existsSync(scm))('the INITIAL mission adds 209 set pieces', () => {
 const pieces=readInitialSetPieces(new Uint8Array(readFileSync(scm)));
 expect(pieces).toHaveLength(209);
 expect(pieces[0]).toEqual({type:3,area:[2435.199951171875,-1741,2454.89990234375,-1723.4000244140625],spawn1:[2481,-1707],target1:[2480,-1732],spawn2:[2481,-1707],target2:[2480,-1732]});
});
