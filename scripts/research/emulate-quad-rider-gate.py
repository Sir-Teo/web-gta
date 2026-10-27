"""Capture quad player-control entry gating with external actor/task services."""
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

from unicorn import UC_HOOK_CODE
uc=Uc(UC_ARCH_ARM64,UC_MODE_ARM)
for page in [0x10046e000,0x100238000,0x100259000,0x100323000,0x10041e000,0x100446000]:
 uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
uc.mem_map(0x20000000,0x8000)
vehicle,handling,ped,tasks=0x20000000,0x20001000,0x20002000,0x20003000
profile={};events=[]
def hook(uc,addr,size,user):
 if addr==0x10046ea1c:events.append('playerControlContinuation');uc.emu_stop();return
 if addr in [0x100238c74,0x100259994,0x1003235a4,0x10041eb3c,0x100446610]:
  result=0
  if addr==0x1003235a4:result=int(profile['player'])
  elif addr==0x10041eb3c:result=0x20004000 if uc.reg_read(UC_ARM64_REG_W1)==profile['task'] else 0
  elif addr==0x100446610:events.append('automobileAiDelegation')
  uc.reg_write(UC_ARM64_REG_X0,result);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
uc.hook_add(UC_HOOK_CODE,hook)
def capture(status,driver,player,task,pedState):
 global profile
 profile=locals().copy();events.clear();uc.mem_write(vehicle,bytes(0x8000));uc.mem_write(vehicle+0x5a,bytes([status<<3]));uc.mem_write(vehicle+0x560,b'\xff');uc.mem_write(vehicle+0x4a8,struct.pack('<Q',handling));uc.mem_write(vehicle+0x5a0,struct.pack('<Q',ped if driver else 0));uc.mem_write(ped+0x538,struct.pack('<Q',tasks));uc.mem_write(ped+0x54c,struct.pack('<I',pedState));uc.reg_write(UC_ARM64_REG_SP,0x20007000);uc.reg_write(UC_ARM64_REG_X0,vehicle);uc.reg_write(UC_ARM64_REG_X1,0x20006000);uc.reg_write(UC_ARM64_REG_LR,0x20005000)
 uc.emu_start(0x10046e914,0x20005000,count=1000)
 pc=uc.reg_read(UC_ARM64_REG_PC)
 if pc not in [0x10046ea1c,0x20005000]:raise RuntimeError('Unexpected quad gate stop.')
 return {'input':profile,'continue':pc==0x10046ea1c,'events':events.copy()}
rows=[capture(status,driver,player,task,pedState) for status in [0,1,3] for driver in [False,True] for player in [False,True] for task in [0,0x329,0x337,0x339] for pedState in [0,63]]
args.output.write_text(json.dumps({'source':'Actual CQuadBike::ProcessAI entry through player-control continuation or return. Declared status/driver/player/task/ped-state and recording ID=-1. External actor/task lookups, unused model lookup, reference cleanup and automobile AI delegation; no gate branches stubbed','sha256':sha256,'entry':'0x10046e914','continuation':'0x10046ea1c','cases':rows},indent=2)+'\n');print(json.dumps({'cases':len(rows)}))
