"""Capture established ground sprint association playback.

Executes the complete selected SetRealMoveAnim routine with established walk,
run and sprint associations. Association lookup and UpdateSprintStats are
explicit logged stubs. Requires Unicorn 2.1.4; no download.
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

from unicorn import UC_HOOK_CODE
uc=Uc(UC_ARCH_ARM64,UC_MODE_ARM)
for page in [0x10035e000,0x10035f000,0x100140000,0x100265000,0x10058c000,0x100651000]:
 uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
uc.mem_map(0x1007a3000,0x2000);uc.mem_map(0x1007c4000,0x1000);uc.mem_map(0x20000000,0x10000)
ped=0x20000000;player=ped+0x1000;walk=ped+0x2000;run=ped+0x2100;sprint=ped+0x2200;stack=ped+0xe000;sentinel=ped+0xf000;events=[]
def hook(uc,addr,size,unused):
 if addr==0x1001405a8:
  anim=uc.reg_read(UC_ARM64_REG_W1);result={0:walk,1:run,2:sprint}.get(anim,0)
  events.append({'address':hex(addr),'animation':anim,'result':result});uc.reg_write(UC_ARM64_REG_X0,result)
 elif addr==0x100265518:events.append({'address':hex(addr),'name':'UpdateSprintStats','stub':'no external stat mutation'})
 else:return
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
uc.hook_add(UC_HOOK_CODE,hook)
def f(x):return struct.unpack('<f',struct.pack('<f',x))[0]
rows=[]
for speed in [-1,0,.01,1,4,4.999999,5,5.000001,6,8,9.9,10]:
 for camera in [0,15]:
  for delta in [0,-1]:
   events=[];uc.mem_write(ped,bytes(0x10000));uc.mem_write(ped+0x540,struct.pack('<Q',player));uc.mem_write(ped+0x550,struct.pack('<I',7));uc.mem_write(player+0x20,struct.pack('<fff',f(128/60),450,f(speed)))
   for assoc,blend in [(walk,0),(run,0),(sprint,1)]:
    uc.mem_write(assoc+0x30,struct.pack('<ffff',blend,delta if assoc==sprint else 0,.2,.9));uc.mem_write(assoc+0x46,struct.pack('<H',1))
   uc.mem_write(0x1007a3da0+0x5f,bytes([0]));uc.mem_write(0x1007a3da0+0x186,struct.pack('<H',camera))
   uc.reg_write(UC_ARM64_REG_X0,ped);uc.reg_write(UC_ARM64_REG_SP,stack);uc.reg_write(UC_ARM64_REG_LR,sentinel);uc.emu_start(0x10035eaa4,sentinel,count=2000)
   if uc.reg_read(UC_ARM64_REG_PC)!=sentinel:raise RuntimeError('SetRealMoveAnim did not return within its instruction budget.')
   rows.append({'input':{'buttonSpeed':f(speed),'cameraMode':camera,'sprintDelta':delta},'speed':struct.unpack('<f',uc.mem_read(sprint+0x3c,4))[0],'delta':struct.unpack('<f',uc.mem_read(sprint+0x34,4))[0],'external':events.copy()})
args.output.write_text(json.dumps({'source':'Complete selected iOS SetRealMoveAnim, established ground sprint associations; declared lookup and sprint-stat stubs','sha256':sha256,'function':'0x10035eaa4','cases':rows},indent=2)+'\n');print(json.dumps({'cases':len(rows)}))
