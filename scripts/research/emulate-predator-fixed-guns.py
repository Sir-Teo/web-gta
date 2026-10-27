"""Capture pinned iOS Predator fixed-gun instructions with Unicorn 2.1.4.

External pad/RNG/aim/shot/audio calls are logged stubs. Native timing, clip,
spread and transform-point arithmetic execute unchanged. Requires the existing pinned binary; no download.
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

import math
uc=Uc(UC_ARCH_ARM64,UC_MODE_ARM)
stubs={0x100242cac:'pad',0x1002437fc:'trigger',0x1004ed718:'random',0x10049a930:'aim',0x10049b350:'shot',0x100171164:'audio',0x100256130:'playerVehicle'}
for page in sorted(set([0x10049b000,0x1002cb000,0x10058c000,0x100593000,0x10058f000,0x1007a3000,0x1007c4000]+[a&~0xfff for a in stubs])):
 uc.mem_map(page,0x1000)
 if page not in [0x1007a3000,0x1007c4000]:uc.mem_write(page,data(page,0x1000))
boat=0x20000000;matrix=boat+0x1000;driver=boat+0x2000;stack=boat+0xe000;sentinel=boat+0xf000
uc.mem_map(boat,0x10000)
calls=[];randoms=[];trigger=False
def point(ptr):return list(struct.unpack('<fff',uc.mem_read(ptr,12)))
def hook(uc,address,size,unused):
 if address not in stubs:return
 name=stubs[address];entry={'call':name}
 if name=='pad':entry['index']=uc.reg_read(UC_ARM64_REG_X0);uc.reg_write(UC_ARM64_REG_X0,boat+0x3000)
 elif name=='trigger':uc.reg_write(UC_ARM64_REG_X0,int(trigger))
 elif name=='random':
  value=randoms.pop(0);entry['value']=value;uc.reg_write(UC_ARM64_REG_X0,value)
 elif name=='aim':entry.update(start=point(uc.reg_read(UC_ARM64_REG_X2)),end=point(uc.reg_read(UC_ARM64_REG_X3)))
 elif name=='shot':entry.update(start=point(uc.reg_read(UC_ARM64_REG_X0)),end=point(uc.reg_read(UC_ARM64_REG_X1)),intensity=uc.reg_read(UC_ARM64_REG_X2))
 elif name=='audio':entry.update(event=uc.reg_read(UC_ARM64_REG_X1),weapon=uc.reg_read(UC_ARM64_REG_X2))
 calls.append(entry);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
uc.hook_add(UC_HOOK_CODE,hook)
def run(now=151,last=0,clip=20,pressed=True,forward=True,gunOff=False,player2=False,yaw=0,pitch=0,rng=None):
 global calls,randoms,trigger
 calls=[];randoms=list(rng if rng is not None else [128]*6);trigger=pressed
 uc.mem_write(boat,bytes(0x10000));uc.mem_write(boat+0x18,struct.pack('<Q',matrix));uc.mem_write(boat+0x5a0,struct.pack('<Q',driver));uc.mem_write(driver+0x720,struct.pack('<I',int(player2)))
 # Native matrix axes: yaw about Z followed by pitch about local X; input arithmetic only.
 c,s=math.cos(yaw),math.sin(yaw);cp,sp=math.cos(pitch),math.sin(pitch)
 values=[c,s,0,0,-s*cp,c*cp,sp,0,s*sp,-c*sp,cp,0,12,-8,3,0]
 uc.mem_write(matrix,struct.pack('<16f',*values));uc.mem_write(boat+0x65c,struct.pack('<I',last));uc.mem_write(boat+0x61d,bytes([clip]));uc.mem_write(boat+0x56a,bytes([128 if gunOff else 0]))
 uc.mem_write(0x1007c4478,struct.pack('<I',now));uc.mem_write(0x1007a3f38,struct.pack('<I',3 if forward else 1))
 uc.reg_write(UC_ARM64_REG_X0,boat);uc.reg_write(UC_ARM64_REG_SP,stack);uc.reg_write(UC_ARM64_REG_LR,sentinel)
 uc.emu_start(0x10049b9f8,sentinel,count=2000)
 return {'input':dict(nowMs=now,lastShotMs=last,clip=clip,pressed=pressed,forward=forward,gunOff=gunOff,player2=player2,matrix=list(struct.unpack('<16f',struct.pack('<16f',*values))),random=list(rng if rng is not None else [128]*6)),'calls':calls,'lastShotMs':struct.unpack('<I',uc.mem_read(boat+0x65c,4))[0],'clip':uc.mem_read(boat+0x61d,1)[0]}
rows=[]
for yaw,pitch in [(0,0),(math.pi/2,0),(-math.pi/2,0),(math.pi,0),(.7,.4),(0,math.pi/2)]:
 for rng in [[128]*6,[0]*6,[255]*6,[1,128,254,65535,32768,127]]:rows.append(run(yaw=yaw,pitch=pitch,rng=rng))
for now in [0,150,151,1400,1401,1550,1551]:
 for pressed in [False,True]:rows.append(run(now=now,clip=1,pressed=pressed))
rows.extend([run(clip=0),run(clip=1),run(player2=True),run(forward=False,now=2000,clip=3),run(gunOff=True,now=1401,clip=3),run(now=10,last=0xfffffff0),run(now=135,last=0xfffffff0),run(now=0xffffffff,last=0xfffffff0)])
fixture={'source':'Pinned iOS arm64 CVehicle::DoFixedMachineGuns/FireFixedMachineGuns; pad/RNG/aim/shot/audio logged stubs, actual matrix-transform instructions executed','sha256':sha256,'wrapper':'0x10049b9f8','fire':'0x10049baa4','transformPoint':'0x1002cb450','aiming':'Endpoints are captured before DoTankDoomAiming; aiming stub leaves them unchanged','cases':rows}
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(fixture,indent=2)+'\n');print(json.dumps({'cases':len(rows),'first':rows[0]}))
