"""Capture complete selected running/sprinting training with actual body exercise.

All caller, body and stat-mutation instructions execute unchanged. Only the
CheckForStatsMessage and DisplayScriptStatUpdateMessage calls are logged stubs.
Body entry and stamina-store hooks only observe; they do not skip instructions.
Uses packaged AR_STATS.DAT and the pinned reference binary; no download.
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
 if addr==0x100265280:
  events.append({'name':'BodyExercise','address':hex(addr),'rate':uc.reg_read(UC_ARM64_REG_W0)});return
 if addr in [0x100265584,0x1002656b0]:
  events.append({'name':'StaminaWrite','address':hex(addr),'before':struct.unpack('<f',uc.mem_read(0x1007bd9e4+22*4,4))[0],'after':single(UC_ARM64_REG_S0),'amount':struct.unpack('<f',uc.mem_read(0x1007bdea8+(2 if addr==0x100265584 else 3)*4,4))[0]});return
 if addr==0x100260300:events.append({'name':'CheckForStatsMessage','address':hex(addr)})
 elif addr==0x1002b0620:events.append({'name':'DisplayScriptStatUpdateMessage','address':hex(addr),'increase':bool(uc.reg_read(UC_ARM64_REG_W0)),'stat':uc.reg_read(UC_ARM64_REG_W1),'value':single(UC_ARM64_REG_S0),'max':single(UC_ARM64_REG_S1)})
 else:return
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
uc.hook_add(UC_HOOK_CODE,hook)
def f(x):return struct.unpack('<f',struct.pack('<f',x))[0]
def run(mode,counter,ts,stamina=100,energy=0,fatCounter=0,healthCounter=0,fat=200,muscle=50,health=569,overrides=None,show=False):
 global events
 events=[];v=values.copy()
 for key,value in (overrides or {}).items():v[key]=value
 uc.mem_write(0x1007bdea8,struct.pack('<59f',*v));uc.mem_write(0x1007bd9e4+21*4,struct.pack('<ffff',fat,stamina,muscle,health));uc.mem_write(0x1007bdb2c+45*4,struct.pack('<i',energy))
 uc.mem_write(0x1007bea24,struct.pack('<I',fatCounter));uc.mem_write(0x1007bea34,struct.pack('<I',healthCounter));uc.mem_write(0x1007c44a0,struct.pack('<f',ts));uc.mem_write(0x1009335f8,b'\0');uc.mem_write(0x10064a04c,bytes([int(show)]))
 addr,countAddr=(0x100265518,0x1007bea00) if mode=='sprinting' else (0x100265644,0x1007bea28)
 uc.mem_write(countAddr,struct.pack('<I',counter));uc.reg_write(UC_ARM64_REG_SP,0x2000e000);uc.reg_write(UC_ARM64_REG_LR,0x2000f000);uc.emu_start(addr,0x2000f000,count=4000)
 if uc.reg_read(UC_ARM64_REG_PC)!=0x2000f000:raise RuntimeError('Training did not return.')
 nextFat,nextStamina,nextMuscle,nextHealth=struct.unpack('<ffff',uc.mem_read(0x1007bd9e4+21*4,16))
 return {'input':{'mode':mode,'counter':counter,'timeStep':f(ts),'stamina':f(stamina),'energy':energy,'fatCounter':fatCounter,'healthCounter':healthCounter,'fat':f(fat),'muscle':f(muscle),'maxHealth':f(health),'overrides':overrides or {},'showUpdates':show},'counter':struct.unpack('<I',uc.mem_read(countAddr,4))[0],'fat':nextFat,'stamina':nextStamina,'muscle':nextMuscle,'maxHealth':nextHealth,'fatCounter':struct.unpack('<I',uc.mem_read(0x1007bea24,4))[0],'healthCounter':struct.unpack('<I',uc.mem_read(0x1007bea34,4))[0],'messageState':uc.mem_read(0x1009335f8,1)[0],'external':events.copy()}
rows=[]
for mode in ['sprinting','running']:
 for counter in [0,300000,300001]:
  for ts in [.5,50/60,50/30,1]:
   for stamina,energy in [(100,0),(999,-1),(1000,-1),(-1,0)]:rows.append(run(mode,counter,ts,stamina,energy))
 for amount in [-1,0,.5,1,1.0001,10]:rows.append(run(mode,300001,50/30,overrides={2 if mode=='sprinting' else 3:amount}))
 for counter in [16777215,16777216,16777217,0xfffffffe]:
  for ts in [50/30,1e8]:rows.append(run(mode,counter,ts,overrides={35 if mode=='sprinting' else 36:1e9,42:1e9,45:1e9}))
 for counter in [16777215,16777216,16777217]:rows.append(run(mode,counter,50/30,overrides={35 if mode=='sprinting' else 36:16777.216}))
 for counter in [299999,300000,300001]:rows.append(run(mode,counter,50/30,100,-1,150001,600001,show=True))
# Live sequential run (+5), then sprint (+10), with body counters seeded to zero.
rows.append(run('sprinting',300001,50/30,105))
args.output.write_text(json.dumps({'source':'Complete selected run/sprint training and actual body exercise; logged CheckForStatsMessage/DisplayScriptStatUpdateMessage stubs','sha256':sha256,'functions':{'sprinting':'0x100265518','running':'0x100265644','body':'0x100265280'},'configuration':values,'arStatsSha256':hashlib.sha256(config).hexdigest(),'cases':rows},indent=2)+'\n');print(json.dumps({'cases':len(rows)}))
