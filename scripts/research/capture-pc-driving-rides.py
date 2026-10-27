"""Compile the unmodified reversed-PC driving ride selector and capture its IDs.

This is a source-compiled reference, not a retail PC executable capture. Category
lookups and CStats inputs are declared. Magnitude uses scalar float32 operations
with FP contraction disabled; original PC x87/renderer/task timing is not emulated.
"""
import argparse,hashlib,itertools,json,os,struct,subprocess,tempfile
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--profiles',type=Path);args=p.parse_args()
commit='4281f82d8af83e14935ac84a69dfd1ceebb9f256'
identities={'source/game_sa/Entity/Vehicle/Vehicle.cpp':'58cb9544808afd23f3de1b5e43ad73463fabb66a438a394f6ffb0cd5cd3b19d8','source/game_sa/RideAnims.h':'6503e5b65f1ffd3dd1d20146697d47ee79eded04470becdc37018b1e70ca586a','source/game_sa/Enums/AnimationEnums.h':'050232f3cbef01f3308b3070bdd363a8664926a520a3e7827b18a8677b22231d'}
for path,digest in identities.items():
 if hashlib.sha256((args.source/path).read_bytes()).hexdigest()!=digest:raise ValueError(f'Unexpected reversed source: {path}')
vehicle=(args.source/'source/game_sa/Entity/Vehicle/Vehicle.cpp').read_text();at=vehicle.index('void CVehicle::ProcessDrivingAnims(');start=vehicle.index('    CRideAnims* usedAnims;',at);end=vehicle.index('    // 0x6DF620',start);selector=vehicle[start:end]
header='''#include <cmath>
#include <cstdint>
#include <iostream>
using int32=int32_t;
#include "RideAnims.h"
enum class eStats { STAT_DRIVING_SKILL=160 };
float suppliedSkill;
struct CStats {static float GetStatValue(eStats){return suppliedSkill;}};
struct CVehicleAnimGroupData {
 static bool UsesKartDrivingAnims(AssocGroupId group){return (static_cast<int>(group)&1)!=0;}
 static bool UsesTruckDrivingAnims(AssocGroupId group){return (static_cast<int>(group)&2)!=0;}
};
struct Harness {
 struct {bool bLowVehicle;} vehicleFlags;
 struct Handling {bool m_bSitInBoat;int m_nAnimGroup;} handling;
 Handling* m_pHandlingData=&handling;
 struct Vec {float x,y,z;float Magnitude() const{return std::sqrt(x*x+y*y+z*z);}} m_vecMoveSpeed;
 bool boat;
 bool IsBoat() const{return boat;}
 const CRideAnims* choose(){
'''
footer='''    return usedAnims;
 }
};
int main(){
 int low,boat,sit,kart,truck;float skill,x,y,z;
 while(std::cin>>low>>boat>>sit>>kart>>truck>>skill>>x>>y>>z){
  suppliedSkill=skill;Harness v;v.vehicleFlags.bLowVehicle=low;v.boat=boat;v.handling={static_cast<bool>(sit),kart|(truck<<1)};v.m_vecMoveSpeed={x,y,z};
  const auto* r=v.choose();std::cout<<r->idle<<' '<<r->left<<' '<<r->right<<' '<<r->back<<'\\n';
 }
}
'''
def f(x):return struct.unpack('<f',struct.pack('<f',x))[0]
kinds=[{},dict(low=True),dict(boat=True),dict(boat=True,sitInBoat=True),dict(kart=True),dict(truck=True),dict(low=True,boat=True,kart=True,truck=True),dict(kart=True,truck=True)]
velocities=[[0,0,0],[.4,0,0],[.40000004,0,0],[-.40000004,0,0],[.24,.32,0],[0,.32,.24],[.2,.2,.28],[0,0,.4]]
profiles=[]
for kind,skill,velocity in itertools.product(kinds,[0,49.999996,50,50.000004,99.99999,100,100.00001,1000],velocities):profiles.append(dict(low=False,boat=False,sitInBoat=False,kart=False,truck=False,skill=f(skill),velocity=list(map(f,velocity)))|kind)
fixed=len(profiles)
if args.profiles:
 for row in json.loads(args.profiles.read_text()):
  i=row['sourceInput'];profiles.append(dict(low=bool(i.get('low')),boat=bool(i.get('boat')),sitInBoat=bool(i.get('sitInBoat')),kart=bool(i.get('kart')),truck=bool(i.get('truck')),skill=f(i['skill']),velocity=list(map(f,i['velocity']))))
cxx=os.environ.get('CXX','g++');flags=['-std=c++20','-O2','-ffp-contract=off']
with tempfile.TemporaryDirectory(prefix='pc-driving-rides-') as directory:
 root=Path(directory);(root/'AnimationEnums.h').write_bytes((args.source/'source/game_sa/Enums/AnimationEnums.h').read_bytes());(root/'RideAnims.h').write_bytes((args.source/'source/game_sa/RideAnims.h').read_bytes());(root/'capture.cpp').write_text(header+selector+footer);binary=root/'capture';subprocess.run([cxx,*flags,str(root/'capture.cpp'),'-o',str(binary)],check=True)
 lines=[' '.join(str(v) for v in [int(i['low']),int(i['boat']),int(i['sitInBoat']),int(i['kart']),int(i['truck']),i['skill'],*i['velocity']]) for i in profiles];result=subprocess.run([str(binary)],input='\n'.join(lines)+'\n',text=True,capture_output=True,check=True);ids=[list(map(int,row.split())) for row in result.stdout.splitlines()]
if len(ids)!=len(profiles):raise RuntimeError('Reference output count mismatch')
args.output.write_text(json.dumps({'source':'Unmodified reversed-PC ProcessDrivingAnims selector fragment compiled with original RideAnims/AnimationEnums headers; category/stat services declared. Source reference, not retail-PC binary capture.','commit':commit,'sha256':identities,'compiler':subprocess.run([cxx,'--version'],text=True,capture_output=True,check=True).stdout.splitlines()[0],'flags':flags,'selectorSource':selector,'fixedCases':fixed,'cases':[{'input':i,'ids':r} for i,r in zip(profiles,ids)]},indent=2)+'\n');print(json.dumps({'fixed':fixed,'cases':len(profiles)}))
