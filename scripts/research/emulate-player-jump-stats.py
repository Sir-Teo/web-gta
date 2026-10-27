"""Capture jump stat playback and force/velocity from the pinned selected binary.

Runs complete StartLaunchAnim/Launch plus actual CStats mode 2 and actual
CPhysical::ApplyMoveForce. Declared lookups, player/world queries, callback
and BlendAnimation stubs; heading-zero trig stubs return exact 0 and 1.
Velocity starts at zero; the platform-specific retention branch is out of scope.
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
for page in [0x100417000,0x100248000,0x100140000,0x10013d000,0x100139000,0x100323000,0x100268000,0x1001ad000,0x1004ed000,0x1004ec000,0x100266000,*range(0x10058c000,0x100596000,0x1000)]:
 uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
uc.mem_map(0x1007bd000,0x2000);uc.mem_map(0x10071d000,0x1000);uc.mem_map(0x20000000,0x10000)
task=0x20000000;ped=task+0x1000;player=task+0x2000;assoc=task+0x3000;runAssoc=task+0x3100;sprintAssoc=task+0x3200;matrix=task+0x5000;stack=task+0xe000;sentinel=task+0xf000;profile={};events=[];requestedForce=None

def single(reg):return struct.unpack('<f',struct.pack('<I',uc.reg_read(reg)))[0]
def hook(uc,addr,size,unused):
 global requestedForce
 if addr==0x1002482d4:
  requestedForce=[single(UC_ARM64_REG_S0),single(UC_ARM64_REG_S1),single(UC_ARM64_REG_S2)];return # actual function executes
 if addr==0x1001405a8:
  anim=uc.reg_read(UC_ARM64_REG_W1);result=runAssoc if anim==1 and profile['run'] is not None else sprintAssoc if anim==2 and profile['sprint'] is not None else 0
  events.append({'address':hex(addr),'name':'GetAssociation','animation':anim,'result':result});uc.reg_write(UC_ARM64_REG_X0,result)
 elif addr==0x10013d5dc:
  events.append({'address':hex(addr),'name':'BlendAnimation','animation':uc.reg_read(UC_ARM64_REG_W2),'initialSpeed':1,'result':assoc});uc.reg_write(UC_ARM64_REG_X0,assoc)
 elif addr==0x100139088:events.append({'address':hex(addr),'name':'SetFinishCallback','stub':'no callback during call'})
 elif addr==0x1003235a4:
  events.append({'address':hex(addr),'name':'IsPlayer','result':profile['player']});uc.reg_write(UC_ARM64_REG_W0,int(profile['player']))
 elif addr==0x10026870c:
  events.append({'address':hex(addr),'name':'IsSteepSlope','result':False});uc.reg_write(UC_ARM64_REG_W0,0)
 elif addr==0x1001adefc:
  events.append({'address':hex(addr),'name':'IsPlayerAllowedToGoInThisDirection','result':True});uc.reg_write(UC_ARM64_REG_W0,1)
 elif addr in [0x1004ed7cc,0x1004ecdb8]:
  angle=single(UC_ARM64_REG_S0)
  if angle!=0:raise ValueError('Only heading zero has declared exact trig inputs.')
  value=0 if addr==0x1004ed7cc else 1;events.append({'address':hex(addr),'name':'heading-zero sinf' if value==0 else 'heading-zero cosf','result':value});uc.reg_write(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',value))[0])
 else:return
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
uc.hook_add(UC_HOOK_CODE,hook)
def f(x):return struct.unpack('<f',struct.pack('<f',x))[0]
def seed(fat,muscle,run=None,sprint=None,mega=False,climb=False,playerPed=True,highJump=False):
 global profile,events,requestedForce
 profile={'fat':f(fat),'muscle':f(muscle),'run':run,'sprint':sprint,'megaJump':mega,'climbJump':climb,'player':playerPed,'highJump':highJump};events=[];requestedForce=None;uc.mem_write(task,bytes(0x10000));uc.mem_write(0x1007bd9e4+21*4,struct.pack('<fff',fat,100,muscle));uc.mem_write(ped+0x540,struct.pack('<Q',player if playerPed else 0));uc.mem_write(ped+0x18,struct.pack('<Q',matrix));uc.mem_write(matrix+0x14,struct.pack('<f',1));uc.mem_write(matrix+0x28,struct.pack('<f',1));uc.mem_write(ped+0xb0,struct.pack('<f',70));uc.mem_write(task+0x32,bytes([int(climb)]));uc.mem_write(task+0x35,bytes([int(highJump)]));uc.mem_write(assoc+0x3c,struct.pack('<f',1));uc.mem_write(0x10071d788+0x44,bytes([int(mega)]))
 if run is not None:uc.mem_write(runAssoc+0x30,struct.pack('<f',run))
 if sprint is not None:uc.mem_write(sprintAssoc+0x30,struct.pack('<f',sprint))
def execute(addr):
 uc.reg_write(UC_ARM64_REG_X0,task);uc.reg_write(UC_ARM64_REG_X1,ped);uc.reg_write(UC_ARM64_REG_SP,stack);uc.reg_write(UC_ARM64_REG_LR,sentinel);uc.emu_start(addr,sentinel,count=3000)
 if uc.reg_read(UC_ARM64_REG_PC)!=sentinel:raise RuntimeError('Native jump routine did not return.')
pairs=[(0,0),(200,50),(200.00001,50),(1000,0),(0,1000),(1000,1000),(-100,-100),(500,500),(3000,3000)]
starts=[]
for fat,muscle in pairs:
 seed(fat,muscle);execute(0x100417818);starts.append({'input':profile.copy(),'speed':struct.unpack('<f',uc.mem_read(assoc+0x3c,4))[0],'started':uc.reg_read(UC_ARM64_REG_W0),'external':events.copy()})
seed(0,0,playerPed=False);execute(0x100417818);starts.append({'input':profile.copy(),'speed':struct.unpack('<f',uc.mem_read(assoc+0x3c,4))[0],'started':uc.reg_read(UC_ARM64_REG_W0),'external':events.copy()})
rows=[]
profiles=[(run,sprint) for run,sprint in [(None,None),(0,None),(.5,None),(1,None),(None,0),(None,.5),(None,1)]]
for fat,muscle in pairs:
 for run,sprint in profiles:
  for mega in [False,True]:
   for climb in [False,True]:
    seed(fat,muscle,run,sprint,mega,climb);execute(0x100417418);rows.append({'input':profile.copy(),'force':requestedForce,'velocity':list(struct.unpack('<fff',uc.mem_read(ped+0x68,12))),'external':events.copy()})
for high in [False,True]:
 for run,sprint in [(None,None),(1,None),(None,1)]:
  seed(0,0,run,sprint,playerPed=False,highJump=high);execute(0x100417418);rows.append({'input':profile.copy(),'force':requestedForce,'velocity':list(struct.unpack('<fff',uc.mem_read(ped+0x68,12))),'external':events.copy()})
args.output.write_text(json.dumps({'source':'Complete selected jump start/launch, actual modifier 2 and ApplyMoveForce; declared external lookup/world/animation queries, exact heading-zero trig; zero initial velocity','sha256':sha256,'startFunction':'0x100417818','launchFunction':'0x100417418','forceFunction':'0x1002482d4','starts':starts,'launches':rows},indent=2)+'\n');print(json.dumps({'starts':len(starts),'launches':len(rows)}))
