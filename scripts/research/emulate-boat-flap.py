"""Capture CBoat hinge initialization and CDoor boat integration from the pinned iOS executable.

Unicorn 2.1.4; no download or host replacement for the captured instructions.
Torque is the input to the integration region, not an independently captured point-speed calculation.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
from unicorn import Uc, UC_ARCH_ARM64, UC_MODE_ARM
from unicorn.arm64_const import UC_ARM64_REG_X19, UC_ARM64_REG_X20, UC_ARM64_REG_S0

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
for page in [0x10045b000,0x10045f000,0x100590000,0x100593000,0x100595000,0x100653000,0x10058e000,0x100596000]:
 uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
boat=0x20000000;door=boat+0x7c8
uc.mem_map(boat,0x2000)
def f(value):return struct.unpack('<f',struct.pack('<f',value))[0]
def initialize(model):
 uc.mem_write(boat,bytes(0x2000));uc.mem_write(boat+0x32,struct.pack('<H',model))
 uc.reg_write(UC_ARM64_REG_X19,boat);uc.emu_start(0x10045b068,0x10045b0ac,count=100)
 opened,closed,dirn,axis,state=struct.unpack('<ffHBB',uc.mem_read(door,12))
 return {'model':model,'openAngle':opened,'closedAngle':closed,'dirn':dirn,'axis':axis,'state':state}
constructors=[initialize(model) for model in [452,484]]
def run(torque,angle,velocity):
 initialize(484);uc.mem_write(boat+0x734,struct.pack('<I',5))
 uc.mem_write(door+0xc,struct.pack('<fff',angle,0,velocity));uc.mem_write(door+0xb,bytes([4]))
 uc.reg_write(UC_ARM64_REG_X19,door);uc.reg_write(UC_ARM64_REG_X20,boat)
 uc.reg_write(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',torque))[0])
 uc.emu_start(0x10045f004,0x10045f244,count=200)
 result,previous,speed=struct.unpack('<fff',uc.mem_read(door+0xc,12))
 return {'torque':f(torque),'angle':f(angle),'angVel':f(velocity),'nextAngle':result,'nextAngVel':speed,'state':uc.mem_read(door+0xb,1)[0]}
limit=constructors[1]['openAngle']
rows=[run(torque,angle,velocity) for torque in [-1,-.01,-.001,0,.0005,.001,.01,1] for angle in [-limit,0,limit] for velocity in [-.4,-.001,0,.001,.4]]
fixture={'source':'Pinned iOS arm64 CBoat constructor and CDoor::Process boat integration executed with Unicorn 2.1.4','sha256':sha256,'constructorRegion':['0x10045b068','0x10045b0ac'],'integrationRegion':['0x10045f004','0x10045f244'],'constructors':constructors,'cases':rows}
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(fixture,indent=2)+'\n')
print(json.dumps({'nativeCases':len(rows),'constructors':constructors,'sha256':sha256}))
