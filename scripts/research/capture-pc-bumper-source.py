"""Replay declared camera matrices/dummies through PC Process_1stPerson source.

This compiles the unmodified dummy/source fragment and boat world-height line.
It is not a retail-PC capture. Matrix/vector primitives are declared scalar
float32 C++ services; bike branches, look handlers and ground-fault protection
are outside this stage. No browser implementation is imported.
"""
import argparse,hashlib,json,os,subprocess,tempfile
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--source',type=Path,required=True)
p.add_argument('--profiles',type=Path,required=True)
p.add_argument('--output',type=Path,required=True)
args=p.parse_args()
path='source/game_sa/Cam.cpp';source=(args.source/path).read_bytes()
digest='2df8f5b892109c4f71173b09558877dbdc79ef0ec6cf3fb15bbfcce9962a214d'
if hashlib.sha256(source).hexdigest()!=digest:raise ValueError('Unexpected PC camera source')
s=source.decode();at=s.index('void CCam::Process_1stPerson(')
start=s.index('    const auto dummyPos = [&]',at);end=s.index('    if (targetVeh->IsBike() && targetVeh->m_pDriver)',start)
fragment=s[start:end];boatLine='        m_vecSource.z += 0.5f;'
if boatLine not in s[end:s.index('// 0x521500',end)]:raise ValueError('Boat height fragment missing')
header='''#include <iostream>
#include <iomanip>
struct CVector {
 float x=0,y=0,z=0;
 CVector operator*(CVector b) const {return {x*b.x,y*b.y,z*b.z};}
 CVector operator+(CVector b) const {return {x+b.x,y+b.y,z+b.z};}
 void operator+=(CVector b){x+=b.x;y+=b.y;z+=b.z;}
};
struct Matrix {
 CVector right,forward,up,position;
 CVector TransformVector(CVector v) const {return {right.x*v.x+forward.x*v.y+up.x*v.z,right.y*v.x+forward.y*v.y+up.y*v.z,right.z*v.x+forward.z*v.y+up.z*v.z};}
};
enum {DUMMY_LIGHT_FRONT_MAIN=0,DUMMY_SEAT_FRONT=4};
struct Vehicle {
 struct Structure {CVector m_avDummyPos[5];} structure;
 struct Info {Structure* value;Structure* GetVehicleStruct(){return value;}} info{&structure};
 bool boat;Matrix matrix;CVector bodyPosition;
 bool IsBoat() const{return boat;}
 Info* GetVehicleModelInfo(){return &info;}
 CVector GetPosition() const{return bodyPosition;}
};
struct Camera {
 CVector m_vecSource;float m_fFOV;
 void process(Vehicle* targetVeh){const auto& entityWorldMat=targetVeh->matrix;
'''
footer=''' }
};
int main(){
 std::cout<<std::setprecision(17);int boat;float x,y,z;
 while(std::cin>>boat){
  Vehicle v;v.boat=boat;
  for(auto* a:{&v.matrix.right,&v.matrix.forward,&v.matrix.up,&v.matrix.position})std::cin>>a->x>>a->y>>a->z;
  std::cin>>v.bodyPosition.x>>v.bodyPosition.y>>v.bodyPosition.z;
  std::cin>>x>>y>>z;v.structure.m_avDummyPos[boat?0:4]={x,y,z};
  Camera c;c.process(&v);std::cout<<c.m_vecSource.x<<' '<<c.m_vecSource.y<<' '<<c.m_vecSource.z<<' '<<c.m_fFOV<<'\\n';
 }
}
'''
rows=json.loads(args.profiles.read_text());rows=rows.get('rows',[]) if isinstance(rows,dict) else rows
inputs=[row['sourceInput'] for row in rows]
lines=[' '.join(map(str,[int(i['boat']),*(v for key in ['right','forward','up','position'] for v in i['matrix'][key]),*i.get('position',i['matrix']['position']),*i['dummy']])) for i in inputs]
cxx=os.environ.get('CXX','g++');flags=['-std=c++20','-O2','-ffp-contract=off']
with tempfile.TemporaryDirectory(prefix='pc-bumper-source-') as directory:
 root=Path(directory);cpp=root/'camera.cpp';binary=root/'camera'
 cpp.write_text(header+fragment+'    if (targetVeh->IsBoat()) {\n'+boatLine+'\n    }\n'+footer)
 subprocess.run([cxx,*flags,str(cpp),'-o',str(binary)],check=True)
 result=subprocess.run([str(binary)],input='\n'.join(lines)+'\n',text=True,capture_output=True,check=True)
 values=[list(map(float,line.split())) for line in result.stdout.splitlines()]
if len(values)!=len(inputs):raise RuntimeError('Reference result count mismatch')
args.output.write_text(json.dumps({'source':'Source-compiled PC Process_1stPerson dummy/source fragment and boat height line; scalar float32 matrix/vector services declared; not a retail-PC capture.','commit':'4281f82d8af83e14935ac84a69dfd1ceebb9f256','sha256':{path:digest},'fragment':fragment,'boatHeightLine':boatLine,'flags':flags,'compiler':subprocess.run([cxx,'--version'],text=True,capture_output=True,check=True).stdout.splitlines()[0],'cases':[{'input':i,'source':v[:3],'fov':v[3]} for i,v in zip(inputs,values)]},indent=2)+'\n')
print(json.dumps({'cases':len(inputs)}))
