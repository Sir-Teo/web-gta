"""Capture pinned iOS lung capacity and player breath reset with Unicorn 2.1.4.

Executes the actual mode-8 stat modifier and ResetPlayerBreath, including
their caller/callee path. No arithmetic or external-call stubs; no download.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
from unicorn import Uc, UC_ARCH_ARM64, UC_MODE_ARM
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
for page in [0x100266000,0x100366000,0x10058c000,0x100593000]:
 uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
uc.mem_map(0x1007bd000,0x2000);uc.mem_map(0x20000000,0x10000)
ped=0x20000000;player=ped+0x1000;stack=ped+0xe000;sentinel=ped+0xf000
rows=[]
for lung in [-1,0,1,100,500,999,1000,1001,16777217]:
 for stamina in [-1,0,1,100,569,999.999,1000]:
  uc.mem_write(0x1007bdb2c+0x1a4,struct.pack('<i',lung));uc.mem_write(0x1007bd9e4+0x58,struct.pack('<f',stamina));uc.reg_write(UC_ARM64_REG_SP,stack);uc.reg_write(UC_ARM64_REG_LR,sentinel);uc.reg_write(UC_ARM64_REG_W0,8);uc.emu_start(0x100266300,sentinel,count=100)
  capacity=struct.unpack('<f',struct.pack('<I',uc.reg_read(UC_ARM64_REG_S0)))[0]
  uc.mem_write(ped+0x540,struct.pack('<Q',player));uc.mem_write(player+0x48,struct.pack('<H',0xffff));uc.reg_write(UC_ARM64_REG_X0,ped);uc.reg_write(UC_ARM64_REG_SP,stack);uc.reg_write(UC_ARM64_REG_LR,sentinel);uc.emu_start(0x100366508,sentinel,count=200)
  breath=struct.unpack('<f',uc.mem_read(player+0x58,4))[0];flags=struct.unpack('<H',uc.mem_read(player+0x48,2))[0]
  rows.append({'lung':lung,'stamina':struct.unpack('<f',struct.pack('<f',stamina))[0],'capacity':capacity,'resetBreath':breath,'resetFlags':flags})
fixture={'source':'Pinned iOS CStats::GetFatAndMuscleModifier mode 8 and CPlayerPed::ResetPlayerBreath executed unchanged; no external arithmetic stubs','sha256':sha256,'modifier':'0x100266300','reset':'0x100366508','cases':rows}
args.output.write_text(json.dumps(fixture,indent=2)+'\n');print(json.dumps({'cases':len(rows),'initial':next(r for r in rows if r['lung']==0 and r['stamina']==100),'max':next(r for r in rows if r['lung']==1000 and r['stamina']==1000)}))
