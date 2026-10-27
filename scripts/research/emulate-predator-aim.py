"""Capture pinned iOS DoTankDoomAiming with Unicorn 2.1.4.

Only FindObjectsInRange is stubbed with an explicit candidate list. Native
filtering, line-distance and endpoint arithmetic execute unchanged. Requires the existing pinned binary; no download.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
from unicorn import Uc, UC_ARCH_ARM64, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm64_const import *

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--binary',required=True,type=Path)
parser.add_argument('--output',required=True,type=Path)
args=parser.parse_args()
b=args.binary.read_bytes()
sha256=hashlib.sha256(b).hexdigest()
if len(b)!=14226544 or sha256!='9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78':
 raise ValueError('The binary is not the pinned iOS reference.')
if struct.unpack_from('>I',b)[0]!=0xcafebabe:raise ValueError('Not a universal Mach-O.')
n=struct.unpack_from('>I',b,4)[0]
off=next(struct.unpack_from('>I',b,8+i*20+8)[0] for i in range(n) if struct.unpack_from('>I',b,8+i*20)[0]==0x100000c)
if struct.unpack_from('<I',b,off)[0]!=0xfeedfacf:raise ValueError('No arm64 Mach-O slice.')
at=off+32
segments=[]
for _ in range(struct.unpack_from('<I',b,off+16)[0]):
 cmd,size=struct.unpack_from('<II',b,at)
 if cmd==0x19:
  vm,vmsz,fo,fsz=struct.unpack_from('<QQQQ',b,at+24)
  segments.append((vm,fo,fsz))
 at+=size
def data(addr,n):
 vm,fo,fsz=next(s for s in segments if s[0]<=addr<s[0]+s[2])
 return b[off+fo+addr-vm:off+fo+addr-vm+n]

uc=Uc(UC_ARCH_ARM64,UC_MODE_ARM)
for page in [0x10049a000,0x10017f000,0x100273000,0x1005ac000,0x10058f000,0x100595000,0x100820000,0x100821000]:
 uc.mem_map(page,0x1000)
 if page not in [0x100820000,0x100821000]:uc.mem_write(page,data(page,0x1000))
base=0x20000000;vehicle=base;matrix=base+0x1000;start=base+0x2000;end=base+0x2100;stack=base+0x1e000;sentinel=base+0x1f000
uc.mem_map(base,0x20000)
uc.mem_write(0x1005ac870,struct.pack('<Q',base+0x2200))
pointers=[];queries=[]
def hook(uc,address,size,unused):
 if address!=0x10027332c:return
 count=uc.reg_read(UC_ARM64_REG_X2);out=uc.reg_read(UC_ARM64_REG_X4)
 queries.append({'max':uc.reg_read(UC_ARM64_REG_X3),'twoD':uc.reg_read(UC_ARM64_REG_X1),'buildings':uc.reg_read(UC_ARM64_REG_X5),'vehicles':uc.reg_read(UC_ARM64_REG_X6),'peds':uc.reg_read(UC_ARM64_REG_X7)})
 uc.mem_write(count,struct.pack('<h',len(pointers)))
 for i,ptr in enumerate(pointers):uc.mem_write(out+i*8,struct.pack('<Q',ptr))
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
uc.hook_add(UC_HOOK_CODE,hook)
def run(candidates,startPoint=None,endPoint=None,vehiclePoint=None):
 global pointers,queries
 candidates=[{'radius':2,'status':3,'scorched':False,'self':False,**c} for c in candidates]
 pointers=[];queries=[];uc.mem_write(base,bytes(0x20000));uc.mem_write(vehicle+0x18,struct.pack('<Q',matrix))
 startPoint=startPoint or [2,2.5,1];endPoint=endPoint or [2,62.5,1];vehiclePoint=vehiclePoint or [0,0,0]
 uc.mem_write(matrix+0x30,struct.pack('<fff',*vehiclePoint));uc.mem_write(start,struct.pack('<fff',*startPoint));uc.mem_write(end,struct.pack('<fff',*endPoint))
 for i,c in enumerate(candidates):
  ptr=base+0x3000+i*0x1000;mat=ptr+0x800;model=100+i;info=ptr+0x900;col=ptr+0xa00
  uc.mem_write(ptr+0x18,struct.pack('<Q',mat));uc.mem_write(mat+0x30,struct.pack('<fff',*c['position']));uc.mem_write(ptr+0x32,struct.pack('<h',model))
  uc.mem_write(ptr+0x5a,bytes([2|(c.get('status',3)<<3)]));uc.mem_write(ptr+0x67,bytes([32 if c.get('scorched',False) else 0]))
  uc.mem_write(0x100820b70+model*8,struct.pack('<Q',info));uc.mem_write(info+0x30,struct.pack('<Q',col));uc.mem_write(col+0x24,struct.pack('<f',c.get('radius',2)))
  pointers.append(vehicle if c.get('self',False) else ptr)
 uc.reg_write(UC_ARM64_REG_X0,vehicle);uc.reg_write(UC_ARM64_REG_X1,0);uc.reg_write(UC_ARM64_REG_X2,start);uc.reg_write(UC_ARM64_REG_X3,end);uc.reg_write(UC_ARM64_REG_SP,stack);uc.reg_write(UC_ARM64_REG_LR,sentinel)
 uc.emu_start(0x10049a930,sentinel,count=10000)
 result=list(struct.unpack('<fff',uc.mem_read(end,12)))
 return {'input':{'vehicle':vehiclePoint,'start':startPoint,'end':endPoint,'candidates':candidates},'end':result,'query':queries[0]}
rows=[run([])]
for x in [0,2,8,8.01,15]:
 for y in [10,30,55]:
  for z in [0,5,15]:rows.append(run([{'position':[x,y,z],'radius':2}]))
for extra in [{'scorched':True},{'status':5},{'status':6},{'status':7},{'self':True},{'radius':.5},{'radius':5}]:rows.append(run([dict(position=[2,30,2],**extra)]))
rows.extend([run([{'position':[2,10,0]},{'position':[2,30,3]}]),run([{'position':[2,30,3]},{'position':[2,10,0]}]),run([{'position':[2,30,2]}],endPoint=[2,62.5,7]),run([{'position':[2,30,8]}],endPoint=[2,62.5,7]),run([{'position':[2,30,0]}],startPoint=[0,0,0],endPoint=[60,0,0])])
fixture={'source':'Pinned iOS arm64 DoTankDoomAiming with explicit FindObjectsInRange candidates; actual native line-segment distance and aim calculations','sha256':sha256,'function':'0x10049a930','lineDistance':'0x10017fd10','cases':rows}
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(fixture,indent=2)+'\n');print(json.dumps({'cases':len(rows),'sample':rows[1],'last':rows[-1]}))
