"""Capture pinned iOS CBoat fire branching with Unicorn 2.1.4.

External effects/events are logged stubs. Native gates, positions and timer
arithmetic execute unchanged. Requires the existing pinned binary; no download.
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
addresses=[0x10045c000,0x100590000,0x10058f000,0x100592000,0x100594000,0x10058c000,0x10057e000,0x1007a3000]
stubs={0x100284944:'kill',0x100283b80:'create',0x1002846e8:'play',0x100290cc8:'constructEvent',0x100286260:'globalEventGroup',0x100285ba8:'addEvent',0x100290d30:'destroyEvent',0x20007000:'explode'}
for page in sorted(set(addresses+[a&~0xfff for a in stubs if a>0x100000000])):
 uc.mem_map(page,0x1000)
 if page!=0x1007a3000:uc.mem_write(page,data(page,0x1000))
boat=0x20000000;matrix=boat+0x1000;camera=boat+0x2000;timer=boat+0x3000;system=boat+0x6000;stack=boat+0x9000
uc.mem_map(boat,0x10000)
uc.mem_write(0x20007000,bytes.fromhex('c0035fd6'))
calls=[];creation_fails=False
def hook(uc,address,size,unused):
 if address not in stubs:return
 name=stubs[address];entry={'call':name}
 if name=='create':
  entry['name']=bytes(uc.mem_read(uc.reg_read(UC_ARM64_REG_X1),32)).split(b'\0')[0].decode('ascii')
  ptr=uc.reg_read(UC_ARM64_REG_X2);entry['position']=list(struct.unpack('<fff',uc.mem_read(ptr,12)));entry['ignoreBounding']=uc.reg_read(UC_ARM64_REG_X4)
  uc.reg_write(UC_ARM64_REG_X0,0 if creation_fails else system)
 calls.append(entry);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
uc.hook_add(UC_HOOK_CODE,hook)
def run(model=452,health=249,dx=0,dy=0,dz=0,existing=False,wrecked=False,timeStep=1,timerMs=0,fail=False):
 global calls,creation_fails
 calls=[];creation_fails=fail
 uc.mem_write(boat,bytes(0x10000));uc.mem_write(0x20007000,bytes.fromhex('c0035fd6'))
 uc.mem_write(boat,struct.pack('<Q',boat+0x8000));uc.mem_write(boat+0x8150,struct.pack('<Q',0x20007000))
 uc.mem_write(boat+0x18,struct.pack('<Q',matrix));uc.mem_write(matrix+0x30,struct.pack('<fff',dx,dy,dz))
 uc.mem_write(0x1007a3db8,struct.pack('<Q',camera));uc.mem_write(boat+0x20,struct.pack('<Q',boat+0x4000));uc.mem_write(boat+0x4008,struct.pack('<Q',boat+0x5000))
 uc.mem_write(boat+0x32,struct.pack('<H',model));uc.mem_write(boat+0x5a,bytes([0x28 if wrecked else 0x18]))
 uc.mem_write(boat+0x634,struct.pack('<f',health));uc.mem_write(boat+0x7f4,struct.pack('<f',timerMs));uc.mem_write(boat+0x710,struct.pack('<Q',system if existing else 0));uc.mem_write(timer,struct.pack('<f',timeStep))
 uc.reg_write(UC_ARM64_REG_X19,boat);uc.reg_write(UC_ARM64_REG_X20,timer);uc.reg_write(UC_ARM64_REG_SP,stack)
 uc.emu_start(0x10045c540,0x10045c6e4,count=1000)
 return {'input':dict(model=model,health=health,dx=dx,dy=dy,dz=dz,existing=existing,wrecked=wrecked,timeStep=timeStep,timerMs=timerMs,fail=fail),'calls':calls,'timerMs':struct.unpack('<f',uc.mem_read(boat+0x7f4,4))[0],'hasFire':bool(struct.unpack('<Q',uc.mem_read(boat+0x710,8))[0])}
rows=[]
for model in [430,452,453,484]:rows.append(run(model=model))
for health in [0,249,250,300,460,460.01,650,1000]:
 for existing in [False,True]:rows.append(run(health=health,existing=existing,timerMs=1000))
for dx,dy,dz in [(199,199,0),(200,0,0),(-200,0,0),(0,200,0),(0,-200,0),(0,0,1000)]:
 for existing in [False,True]:rows.append(run(dx=dx,dy=dy,dz=dz,existing=existing,timerMs=1000))
rows.extend([run(existing=True,wrecked=True,timerMs=1000),run(fail=True),run(timerMs=4999,timeStep=.05),run(timerMs=4999,timeStep=.1),run(existing=True,timeStep=0)])
fixture={'source':'Pinned iOS arm64 CBoat::ProcessControl fire branch with logged external effects/events; native gates, positions and timer arithmetic execute unchanged','sha256':sha256,'region':['0x10045c540','0x10045c6e4'],'externalCreationRegion':['0x10045c870','0x10045c8cc'],'cases':rows}
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(fixture,indent=2)+'\n');print(json.dumps({'cases':len(rows)}))
