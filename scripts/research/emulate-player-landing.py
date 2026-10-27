"""Capture native landing playback and CStats modifier 2 from the pinned binary.

The complete selected CTaskSimpleLand::ProcessPed executes with an upright
pedestrian and declared association, player and pad-query stubs. The stat
modifier, float multiplication, flags and first-update latch run unchanged.
Requires Unicorn 2.1.4; no download.
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
for page in [0x100416000,0x100266000,0x10013d000,0x100139000,0x100323000,0x10035f000,0x100246000,*range(0x10058c000,0x100594000,0x1000)]:
 uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
uc.mem_map(0x1007bd000,0x2000);uc.mem_map(0x20000000,0x10000)
task=0x20000000;ped=task+0x1000;assoc=task+0x3000;pad=task+0x4000;matrix=task+0x5000;stack=task+0xe000;sentinel=task+0xf000;profile={};events=[]
def hook(uc,addr,size,unused):
 if addr==0x10013d5dc:
  events.append({'address':hex(addr),'name':'BlendAnimation','animation':uc.reg_read(UC_ARM64_REG_W2),'initialSpeed':profile['initialSpeed'],'result':assoc});uc.reg_write(UC_ARM64_REG_X0,assoc)
 elif addr==0x100139088:events.append({'address':hex(addr),'name':'SetFinishCallback','stub':'no callback execution during this call'})
 elif addr==0x1003235a4:
  events.append({'address':hex(addr),'name':'IsPlayer','result':profile['isPlayer']});uc.reg_write(UC_ARM64_REG_W0,int(profile['isPlayer']))
 elif addr==0x10035f8e4:
  events.append({'address':hex(addr),'name':'GetPadFromPlayer','result':pad});uc.reg_write(UC_ARM64_REG_X0,pad)
 elif addr==0x1002466d0:
  events.append({'address':hex(addr),'name':'GetSprint','result':profile['held']});uc.reg_write(UC_ARM64_REG_W0,int(profile['held']))
 else:return
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
uc.hook_add(UC_HOOK_CODE,hook)
def f(x):return struct.unpack('<f',struct.pack('<f',x))[0]
def execute(addr,x0,x1=0):
 uc.reg_write(UC_ARM64_REG_X0,x0);uc.reg_write(UC_ARM64_REG_X1,x1);uc.reg_write(UC_ARM64_REG_SP,stack);uc.reg_write(UC_ARM64_REG_LR,sentinel);uc.emu_start(addr,sentinel,count=2000)
 if uc.reg_read(UC_ARM64_REG_PC)!=sentinel:raise RuntimeError('Native routine did not return.')
def stats(fat,muscle):uc.mem_write(0x1007bd9e4+21*4,struct.pack('<fff',fat,100,muscle))
def modifier(fat,muscle):
 stats(fat,muscle);execute(0x100266300,2);return struct.unpack('<f',struct.pack('<I',uc.reg_read(UC_ARM64_REG_S0)))[0]
def run(fat,muscle,moveState,held,isPlayer,animId,initialSpeed=1,existing=False):
 global profile,events
 profile={'fat':f(fat),'muscle':f(muscle),'moveState':moveState,'held':held,'isPlayer':isPlayer,'animId':animId,'initialSpeed':f(initialSpeed),'existing':existing};events=[]
 uc.mem_write(task,bytes(0x10000));stats(fat,muscle);uc.mem_write(ped+0x18,struct.pack('<Q',matrix));uc.mem_write(matrix+0x28,struct.pack('<f',1));uc.mem_write(ped+0x550,struct.pack('<I',moveState));uc.mem_write(task+0x10,struct.pack('<Q',assoc if existing else 0));uc.mem_write(task+0x18,struct.pack('<IB',animId,4));uc.mem_write(assoc+0x3c,struct.pack('<f',initialSpeed))
 execute(0x100416148,task,ped)
 first={'speed':struct.unpack('<f',uc.mem_read(assoc+0x3c,4))[0],'flags':uc.mem_read(task+0x1c,1)[0],'return':uc.reg_read(UC_ARM64_REG_W0),'external':events.copy()}
 # Changing stats and the pad after the first update must not reapply playback.
 stats(1000 if fat!=1000 else 0,1000 if muscle!=1000 else 0);profile['held']=not held;events=[];execute(0x100416148,task,ped)
 second={'speed':struct.unpack('<f',uc.mem_read(assoc+0x3c,4))[0],'flags':uc.mem_read(task+0x1c,1)[0],'return':uc.reg_read(UC_ARM64_REG_W0),'external':events.copy()}
 return {'input':{**profile,'held':held},'first':first,'second':second}
pairs=[(0,0),(200,50),(200.00001,50),(1000,0),(0,1000),(1000,1000),(-100,-100),(500,500),(3000,3000)]
modifiers=[{'fat':f(fat),'muscle':f(muscle),'modifier':modifier(fat,muscle)} for fat in [-100,0,199.99998,200,200.00001,500,1000,3000] for muscle in [-100,0,49.999996,50,50.000004,500,1000,3000]]
rows=[run(fat,muscle,move,held,player,anim) for fat,muscle in pairs for move in [6,7] for held in [False,True] for player in [False,True] for anim in [0x77,0xa]]
rows += [run(1000,1000,move,held,True,0x77,speed,True) for speed in [.5,1,2] for move,held in [(6,False),(7,True)]]
args.output.write_text(json.dumps({'source':'Complete selected CTaskSimpleLand::ProcessPed and actual CStats mode 2; declared animation/player/pad stubs, upright ped','sha256':sha256,'function':'0x100416148','modifierFunction':'0x100266300 mode 2','modifiers':modifiers,'cases':rows},indent=2)+'\n');print(json.dumps({'modifiers':len(modifiers),'landings':len(rows)}))
