"""Capture actual CStats::UpdateFatAndMuscleStats counters and stat mutations.

The complete selected routine executes unchanged; only CheckForStatsMessage
and DisplayScriptStatUpdateMessage are logged external stubs. Uses packaged
AR_STATS.DAT, whose values are declared runtime inputs. No download.
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
for page in [0x100265000,0x100260000,0x1002b0000,0x10058c000,0x100590000,0x10064a000]:
 uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
uc.mem_map(0x1007bd000,0x2000);uc.mem_map(0x1007c4000,0x1000);uc.mem_map(0x100933000,0x1000);uc.mem_map(0x20000000,0x10000)
config=Path('public/play/world/files/data/ar_stats.dat').read_bytes();values=[0.0]*59
for line in config.decode().splitlines():
 row=line.split()
 if len(row)>=3 and row[0].isdigit():values[int(row[0])]=float(row[2])
events=[]
def single(reg):return struct.unpack('<f',struct.pack('<I',uc.reg_read(reg)))[0]
def hook(uc,addr,size,unused):
 if addr==0x100260300:events.append({'name':'CheckForStatsMessage','address':hex(addr)})
 elif addr==0x1002b0620:events.append({'name':'DisplayScriptStatUpdateMessage','address':hex(addr),'increase':bool(uc.reg_read(UC_ARM64_REG_W0)),'stat':uc.reg_read(UC_ARM64_REG_W1),'value':single(UC_ARM64_REG_S0),'max':single(UC_ARM64_REG_S1)})
 else:return
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
uc.hook_add(UC_HOOK_CODE,hook)
def f(x):return struct.unpack('<f',struct.pack('<f',x))[0]
def run(fat,muscle,health,fatCounter,healthCounter,rate,ts,state=0,show=True,overrides=None):
 global events
 events=[];v=values.copy()
 for key,value in (overrides or {}).items():v[key]=value
 uc.mem_write(0x1007bdea8,struct.pack('<59f',*v));uc.mem_write(0x1007bd9e4+21*4,struct.pack('<ffff',fat,100,muscle,health));uc.mem_write(0x1007bea24,struct.pack('<I',fatCounter));uc.mem_write(0x1007bea34,struct.pack('<I',healthCounter));uc.mem_write(0x1007c44a0,struct.pack('<f',ts));uc.mem_write(0x1009335f8,bytes([state]));uc.mem_write(0x10064a04c,bytes([int(show)]))
 uc.reg_write(UC_ARM64_REG_W0,rate);uc.reg_write(UC_ARM64_REG_SP,0x2000e000);uc.reg_write(UC_ARM64_REG_LR,0x2000f000);uc.emu_start(0x100265280,0x2000f000,count=2000)
 if uc.reg_read(UC_ARM64_REG_PC)!=0x2000f000:raise RuntimeError('Body routine did not return.')
 nextFat,_,nextMuscle,nextHealth=struct.unpack('<ffff',uc.mem_read(0x1007bd9e4+21*4,16))
 return {'input':{'fat':f(fat),'muscle':f(muscle),'maxHealth':f(health),'fatCounter':fatCounter,'healthCounter':healthCounter,'exerciseRate':rate,'timeStep':f(ts),'messageState':state,'showUpdates':show,'overrides':overrides or {}},'fat':nextFat,'muscle':nextMuscle,'maxHealth':nextHealth,'fatCounter':struct.unpack('<I',uc.mem_read(0x1007bea24,4))[0],'healthCounter':struct.unpack('<I',uc.mem_read(0x1007bea34,4))[0],'messageState':uc.mem_read(0x1009335f8,1)[0],'external':events.copy()}
rows=[]
for fat,muscle,health in [(200,50,569),(10,995,995),(0,10,1000),(-1,-1,-1),(1500,1500,1500)]:
 for counters in [(0,0),(150000,600000),(150001,600001),(150001,0),(0,600001)]:
  for ts,rate in [(50/60,5),(50/30,10),(50/30,15)]:rows.append(run(fat,muscle,health,*counters,rate,ts))
for state in [0,1,2,3]:
 for show in [False,True]:
  for fat in [200,0]:rows.append(run(fat,50,569,150001,600001,10,1,state,show))
for rate in [0,1,5,10,15,100,0xffffffff]:
 for ts in [0,.5,50/60,50/30,1e8]:rows.append(run(200,50,569,0xfffffffe,0xfffffffe,rate,ts,overrides={42:1e9,45:1e9}))
for amount in [-1,0,.5,1,1.0001,20]:
 for fat in [200,0]:rows.append(run(fat,50,569,150001,600001,10,1,1,True,{9:amount,11:amount,23:amount,24:amount}))
# Live fixed-step caller profiles: run award, retained-state sprint award, then no-fat underwater award.
rows += [run(200,50,569,150001,600001,5,50/30,0),run(185,60,589,150001,0,10,50/30,1),run(0,70,589,150001,0,15,50/30,2)]
args.output.write_text(json.dumps({'source':'Complete selected CStats::UpdateFatAndMuscleStats; actual counter/stat/message-state instructions, logged feedback stubs','sha256':sha256,'function':'0x100265280','configuration':values,'arStatsSha256':hashlib.sha256(config).hexdigest(),'cases':rows},indent=2)+'\n');print(json.dumps({'cases':len(rows)}))
