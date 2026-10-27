"""Capture the selected CBmx rider gate, cadence and pedal/sprint playing decision.

Executes 0x100459cb0 through the existing-association playing-bit/speed
writes. Velocity/basis, vehicle fields and existing fully blended pedal/sprint
associations are declared inputs. No animation-manager calls execute.
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
parser.add_argument('--profiles',type=Path,help='Append observed live input profiles to the fixed native cases.')
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
uc=Uc(UC_ARCH_ARM64,UC_MODE_ARM);uc.mem_map(0x100459000,0x2000);uc.mem_write(0x100459000,data(0x100459000,0x2000));uc.mem_map(0x100595000,0x1000);uc.mem_write(0x100595000,data(0x100595000,0x1000));uc.mem_map(0x10058c000,0x1000);uc.mem_write(0x10058c000,data(0x10058c000,0x1000));uc.mem_map(0x100590000,0x1000);uc.mem_write(0x100590000,data(0x100590000,0x1000));uc.mem_map(0x20000000,0x10000)
def f(x):return struct.unpack('<f',struct.pack('<f',x))[0]
def setSingle(reg,value):uc.reg_write(reg,struct.unpack('<I',struct.pack('<f',value))[0])
def single(reg):return struct.unpack('<f',struct.pack('<I',uc.reg_read(reg)))[0]
mode=None
def hook(uc,addr,size,unused):
 global mode
 if addr==0x100459d10:mode='ride'
 elif addr==0x100459f38 or addr==0x10045a244:mode='pedal'
 elif addr==0x100459f60:mode='sprint'
 if addr in [0x100459db0,0x10045a0a8]:uc.emu_stop()
uc.hook_add(UC_HOOK_CODE,hook)
def run(model,speed,coefficient,gear=1,maxFlatVelocity=.7,lean=0,leanFwd=0,driveBy=False,gas=1,status=0,initialPlaying=True):
 global mode
 mode=None
 pedal,sprint=0x20005000,0x20006000
 for assoc in [pedal,sprint]:
  uc.mem_write(assoc,bytes(0x80));uc.mem_write(assoc+0x30,struct.pack('<ffff',1,0,0,1));uc.mem_write(assoc+0x46,struct.pack('<H',int(initialPlaying)))
 uc.reg_write(UC_ARM64_REG_X25,pedal);uc.reg_write(UC_ARM64_REG_X24,sprint)
 bike,handling=0x20000000,0x20002000;uc.mem_write(bike,bytes(0x4000));uc.mem_write(bike+0x32,struct.pack('<H',model));uc.mem_write(bike+0x628,bytes([gear]));uc.mem_write(bike+0x4a8,struct.pack('<Q',handling));uc.mem_write(handling+0x88,struct.pack('<f',maxFlatVelocity));uc.reg_write(UC_ARM64_REG_X19,bike);uc.mem_write(bike+0xa1c,struct.pack('<f',coefficient));uc.mem_write(bike+0x838,struct.pack('<f',lean));uc.mem_write(bike+0x840,struct.pack('<f',leanFwd));uc.mem_write(bike+0x608,struct.pack('<f',gas));uc.mem_write(bike+0x5a,bytes([status<<3]));uc.reg_write(UC_ARM64_REG_X26,0x20004000 if driveBy else 0)
 setSingle(UC_ARM64_REG_S0,coefficient);setSingle(UC_ARM64_REG_S1,5);setSingle(UC_ARM64_REG_S8,speed);setSingle(UC_ARM64_REG_S9,0);setSingle(UC_ARM64_REG_S10,0);setSingle(UC_ARM64_REG_S13,1);setSingle(UC_ARM64_REG_S11,0);setSingle(UC_ARM64_REG_S12,0);uc.emu_start(0x100459cb0,0x10045a2e0,count=1000);pc=uc.reg_read(UC_ARM64_REG_PC)
 if pc not in [0x100459db0,0x10045a0a8] or mode is None:raise RuntimeError('Cadence branch did not reach a declared continuation.')
 return {'input':{'model':model,'speed':f(speed),'coefficient':f(coefficient),'gear':gear,'maxFlatVelocity':f(maxFlatVelocity),'lean':f(lean),'leanFwd':f(leanFwd),'driveBy':driveBy,'gas':f(gas),'status':status,'initialPlaying':initialPlaying},'cadence':None if mode=='ride' else single(UC_ARM64_REG_S8),'mode':mode,'playing':bool(struct.unpack('<H',uc.mem_read(pedal+0x46,2))[0]&1),'pedalSpeed':struct.unpack('<f',uc.mem_read(pedal+0x3c,4))[0]}
rows=[]
for model in [481,509,510]:
 for speed in [.010001,.1,.2,.5,.8333333,.8333334,1]:
  for coefficient in [0,4.9,5,5.0000001,5.0001,6,10]:rows.append(run(model,speed,coefficient))
for gear in [0,1,2,3,4,5]:
 for velocity in [.5,.7,1]:
  for speed in [.02,.2,.5,1]:rows.append(run(510,speed,5.0001,gear,velocity))
for coefficient in [0,4.9,5,5.0001]:
 for gas in [0,1,-1]:
  for status in [0,2,3]:rows.append(run(481,.2,coefficient,gas=gas,status=status))
for coefficient in [4.9,5.0001]:
 for speed in [-.2,0,.009999,.01,.010001,.2]:
  for lean in [-.70001,-.7,-.4,0,.39999,.4,.69999,.7]:rows.append(run(481,speed,coefficient,lean=lean))
 for leanFwd in [-1,0,.39999,.4,.69999,.7,1]:rows.append(run(481,.2,coefficient,leanFwd=leanFwd))
for driveBy in [False,True]:rows.append(run(481,.2,5.0001,driveBy=driveBy))
for coefficient,gas in [(4.9,1),(5.0001,1),(0,0)]:rows.append(run(481,.2,coefficient,gas=gas,initialPlaying=False))
if args.profiles:
 for i in json.loads(args.profiles.read_text()):
  rows.append(run(i['model'],i['speed'],i['coefficient'],i['gear'],i['maxFlatVelocity'],i['lean'],i['leanFwd'],i['driveBy'],i['gas'],i['status'],i.get('initialPlaying',True)))
args.output.write_text(json.dumps({'source':'Selected CBmx rider gate/cadence plus actual existing-association playing-bit/speed writes; declared fully blended pedal/sprint associations, no animation-manager calls','sha256':sha256,'entry':'0x100459cb0','cases':rows},indent=2)+'\n');print(json.dumps({'cases':len(rows)}))
