"""Capture the selected CBmx player pedal/boost/energy decision block.

Executes 0x100459478 through its continuation at 0x100459558, including
original branches through 0x1004597c0..0x100459884 and actual native player
sprint control/result/energy/stat routines. Declared pad and animation
association inputs, logged external cycling call. Not the complete rider task.
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
for page in [0x100459000,0x10035f000,0x100140000,0x100245000,0x100265000,0x100366000,0x100360000,0x100361000,0x100266000,0x100242000,0x100244000,0x100246000,0x100256000,0x100651000,0x10058c000,0x10058e000,0x10058f000,0x100590000,0x100593000]:
 uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
uc.mem_map(0x1007bd000,0x2000);uc.mem_map(0x1007c4000,0x1000);uc.mem_map(0x20000000,0x10000)
ped,player,pad,bike,assoc,stack=0x20000000,0x20001000,0x20002000,0x20003000,0x20005000,0x2000e000
profile={};events=[]
def f(x):return struct.unpack('<f',struct.pack('<f',x))[0]
def hook(uc,addr,size,unused):
 if addr==0x100265770:
  events.append({'name':'cycling','boost':bool(uc.reg_read(UC_ARM64_REG_W0)),'bikeArgument':uc.reg_read(UC_ARM64_REG_X1)==bike});uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR));return
 replies={0x10035f8e4:pad,0x100242cac:pad,0x1002459ac:profile['accelerate'],0x100245a98:int(profile['acceleratePressed']),0x1001405a8:assoc if profile['fastBlend'] is not None else 0,0x1002467b8:int(profile['justPressed']),0x1002466d0:int(profile['held']),0x100256130:bike,0x100244394:0,0x10024444c:128 if profile['accelerate'] else 0}
 if addr not in replies:return
 uc.reg_write(UC_ARM64_REG_X0,replies[addr]);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
uc.hook_add(UC_HOOK_CODE,hook)
def run(energy,buttonSpeed,accelerate=0,held=False,justPressed=False,steer=0,gas=0,brake=0,fastBlend=None,acceleratePressed=False,boost=False,coefficient=0,ts=50/30,neverTired=False,adrenaline=False,disabled=False):
 global profile,events
 profile=locals().copy();profile.pop('profile',None);events=[]
 uc.mem_write(ped,bytes(0x10000));uc.mem_write(ped+0x540,struct.pack('<Q',player));uc.mem_write(player+0x24,struct.pack('<ff',energy,buttonSpeed));uc.mem_write(player+0x48,struct.pack('<H',2 if adrenaline else 0));uc.mem_write(player+0xa0,bytes([int(disabled)]));uc.mem_write(0x1007c47c8,bytes([int(neverTired)]));uc.mem_write(0x1007c44a0,struct.pack('<f',ts));uc.mem_write(0x1007c49f0,b'\0');uc.mem_write(0x1007bd9e4+22*4,struct.pack('<f',100))
 uc.mem_write(bike+0x5a0,struct.pack('<Q',ped));uc.mem_write(bike+0x600,struct.pack('<ffff',steer,0,gas,brake));uc.mem_write(bike+0x800,bytes([32 if boost else 0]));uc.mem_write(bike+0xa1c,struct.pack('<f',coefficient));uc.mem_write(assoc+0x30,struct.pack('<f',fastBlend or 0));uc.reg_write(UC_ARM64_REG_X19,bike);uc.reg_write(UC_ARM64_REG_X20,pad);uc.reg_write(UC_ARM64_REG_X21,ped);uc.reg_write(UC_ARM64_REG_S8,0x3f800000);uc.reg_write(UC_ARM64_REG_SP,stack);uc.emu_start(0x100459478,0x100459558,count=3000)
 if uc.reg_read(UC_ARM64_REG_PC)!=0x100459558:raise RuntimeError('BMX decision did not reach its original continuation.')
 newEnergy,newButton=struct.unpack('<ff',uc.mem_read(player+0x24,8))
 return {'input':{k:f(v) if isinstance(v,float) else v for k,v in profile.items()},'energy':newEnergy,'buttonSpeed':newButton,'steer':struct.unpack('<f',uc.mem_read(bike+0x600,4))[0],'gas':struct.unpack('<f',uc.mem_read(bike+0x608,4))[0],'brake':struct.unpack('<f',uc.mem_read(bike+0x60c,4))[0],'boost':bool(uc.mem_read(bike+0x800,1)[0]&32),'coefficient':struct.unpack('<f',uc.mem_read(bike+0xa1c,4))[0],'cycling':events.copy()}
rows=[]
for energy in [450,0,-150]:
 for button in [0,4,6,8]:
  for accelerate in [0,255]:
   for held,pressed in [(False,False),(True,False),(True,True)]:
    for steer in [0,.1]:rows.append(run(energy,button,accelerate,held,pressed,steer))
for blend in [None,0,.5,.5001,1]:
 for brake in [0,1]:rows.append(run(450,6,0,False,False,.1,brake=brake,fastBlend=blend))
for boost in [False,True]:
 for coefficient in [0,4.9]:rows.append(run(-150,0,0,steer=.1,boost=boost,coefficient=coefficient))
for steer in [.0000999,.0001,-.0000999,-.0001]:rows.append(run(450,0,255,steer=steer))
for ts in [0,.5,1,50/30,3,6]:
 for accelerate in [0,64,128,255]:
  for pressed in [False,True]:rows.append(run(-149,4,accelerate,True,False,.1,gas=-.5,brake=.5,acceleratePressed=pressed,coefficient=4.9,ts=ts))
for pressed in [False,True]:
 for brake in [0,1]:rows.append(run(-150,0,0,steer=.1,acceleratePressed=pressed,coefficient=4.9,brake=brake))
for flags in [{'neverTired':True},{'adrenaline':True},{'disabled':True}]:rows.append(run(-149.9,8,255,True,True,.1,**flags))
args.output.write_text(json.dumps({'source':'Selected CBmx player boost/control/energy decision block plus actual native sprint controller/result/energy/stat modifier; declared pad/association/training stubs','sha256':sha256,'entry':'0x100459478','continuation':'0x100459558','cases':rows},indent=2)+'\n');print(json.dumps({'cases':len(rows),'steerDeadband':struct.unpack('<f',data(0x10058cb60,4))[0]}))
