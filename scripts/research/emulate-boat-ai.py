"""Capture pinned iOS boat heading controls with Unicorn 2.1.4.

Native heading normalization, angle quadrants/wrap and throttle arithmetic
execute unchanged. The imported _atanf primitive is supplied by host libm
rounded to float32; its library implementation is not captured. Requires the existing pinned binary; no download.
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
for page in [0x10019c000,0x10023f000,0x1004ec000,0x10058c000,0x10058e000,0x100592000,0x100593000]:
 uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
boat=0x20000000;matrix=boat+0x1000;output=boat+0x2000;stack=boat+0xe000;sentinel=boat+0xf000
uc.mem_map(boat,0x10000)
atans=[]
def f(value):return struct.unpack('<f',struct.pack('<f',value))[0]
def hook(uc,address,size,unused):
 if address!=0x1004eccec:return
 value=struct.unpack('<f',struct.pack('<I',uc.reg_read(UC_ARM64_REG_S0)))[0];result=f(math.atan(value));atans.append({'input':value,'output':result})
 uc.reg_write(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',result))[0]);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
uc.hook_add(UC_HOOK_CODE,hook)
def run(forward,target,speed=(0,0),cruise=10,position=(0,0)):
 global atans
 atans=[];uc.mem_write(boat,bytes(0x10000));uc.mem_write(boat+0x18,struct.pack('<Q',matrix));uc.mem_write(matrix+0x10,struct.pack('<ff',*forward));uc.mem_write(matrix+0x30,struct.pack('<ff',*position));uc.mem_write(boat+0x68,struct.pack('<ff',*speed));uc.mem_write(boat+0x500,bytes([cruise]))
 for reg,value in [(UC_ARM64_REG_X0,boat),(UC_ARM64_REG_X1,output),(UC_ARM64_REG_X2,output+4),(UC_ARM64_REG_X3,output+8),(UC_ARM64_REG_SP,stack),(UC_ARM64_REG_LR,sentinel)]:uc.reg_write(reg,value)
 for reg,value in [(UC_ARM64_REG_S0,target[0]),(UC_ARM64_REG_S1,target[1])]:uc.reg_write(reg,struct.unpack('<I',struct.pack('<f',value))[0])
 uc.emu_start(0x10019c4dc,sentinel,count=2000)
 steer,gas,brake=struct.unpack('<fff',uc.mem_read(output,12))
 return {'input':{'position':list(map(f,position)),'forward':list(map(f,forward)),'target':list(map(f,target)),'moveSpeed':list(map(f,speed)),'cruiseSpeed':cruise},'steer':steer,'gas':gas,'brake':brake,'atanf':atans}
axes=[(1,0),(0,1),(-1,0),(0,-1),(1,1),(-1,1),(-1,-1),(1,-1),(0,0)]
rows=[run(forward,(target[0]*50,target[1]*50)) for forward in axes for target in axes]
rows.extend(run((0,1),target,(0,speed),cruise) for target in [(-5,50),(5,50)] for speed in [0,.1,.125,.15,1/6,.25,.25000003,1/3] for cruise in [0,1,10,255])
rows.extend([run((-1,1e-8),(50,0)),run((-1,-1e-8),(50,0)),run((1e-9,1e-9),(1,2)),run((.7,.4),(2600.00001,-2700),(0,.15),10,(2600,-2700))])
fixture={'source':'Pinned iOS SteerAIBoatWithPhysicsHeadingForTarget and CGeneral::GetATanOfXY; actual native float/branch instructions, _atanf import supplied by host libm rounded to float32','sha256':sha256,'heading':'0x10019c4dc','atanOfXY':'0x10023f3dc','atanImport':'0x1004eccec','cases':rows}
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(fixture,indent=2)+'\n');print(json.dumps({'cases':len(rows),'westToEast':rows[18]}))
