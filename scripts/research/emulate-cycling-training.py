"""Capture complete selected CStats::UpdateStatsWhenCycling and its body exercise callee.

Only CheckForStatsMessage and DisplayScriptStatUpdateMessage are logged stubs.
Bike fields, counters, AR_STATS.DAT configuration and raw stat inputs are declared.
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
parser.add_argument('--profiles',type=Path,help='Append declared native input profiles from a live trace.')
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
for page in [0x100265000,0x100260000,0x1002b0000,0x10058c000,0x100590000,0x100592000,0x100593000,0x10064a000,0x100452000]:
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
def run(boost,gas,velocity,wheels,staminaCounter,skillCounter,ts=50/30,fat=200,stamina=100,muscle=50,health=569,skill=0,energy=0,fatCounter=0,healthCounter=0,show=True,overrides=None,messageState=0):
 global events
 events=[];v=values.copy()
 for key,value in (overrides or {}).items():v[int(key)]=value
 uc.mem_write(0x1007bdea8,struct.pack('<59f',*v));uc.mem_write(0x1007bd9e4+21*4,struct.pack('<ffff',fat,stamina,muscle,health));uc.mem_write(0x1007bdb2c+45*4,struct.pack('<i',energy));uc.mem_write(0x1007bdb2c+110*4,struct.pack('<i',skill))
 uc.mem_write(0x1007bea04,struct.pack('<II',staminaCounter,skillCounter));uc.mem_write(0x1007bea24,struct.pack('<I',fatCounter));uc.mem_write(0x1007bea34,struct.pack('<I',healthCounter));uc.mem_write(0x1007c44a0,struct.pack('<f',ts));uc.mem_write(0x1009335f8,bytes([messageState]));uc.mem_write(0x10064a04c,bytes([int(show)]))
 uc.mem_write(0x20000000+0x608,struct.pack('<f',gas));uc.mem_write(0x20000000+0x68,struct.pack('<fff',*velocity));uc.mem_write(0x20000000+0xa08,bytes([wheels]));uc.reg_write(UC_ARM64_REG_W0,int(boost));uc.reg_write(UC_ARM64_REG_X1,0x20000000);uc.reg_write(UC_ARM64_REG_SP,0x2000e000);uc.reg_write(UC_ARM64_REG_LR,0x2000f000);uc.emu_start(0x100265770,0x2000f000,count=4000)
 if uc.reg_read(UC_ARM64_REG_PC)!=0x2000f000:raise RuntimeError('Cycling routine did not return.')
 nextFat,nextStamina,nextMuscle,nextHealth=struct.unpack('<ffff',uc.mem_read(0x1007bd9e4+21*4,16));a,c=struct.unpack('<II',uc.mem_read(0x1007bea04,8))
 return {'input':{'boost':boost,'gas':f(gas),'velocity':[f(x) for x in velocity],'wheels':wheels,'staminaCounter':staminaCounter,'skillCounter':skillCounter,'timeStep':f(ts),'fat':f(fat),'stamina':f(stamina),'muscle':f(muscle),'maxHealth':f(health),'skill':skill,'energy':energy,'fatCounter':fatCounter,'healthCounter':healthCounter,'showUpdates':show,'overrides':overrides or {},'messageState':messageState},'fat':nextFat,'stamina':nextStamina,'muscle':nextMuscle,'maxHealth':nextHealth,'skill':struct.unpack('<i',uc.mem_read(0x1007bdb2c+110*4,4))[0],'staminaCounter':a,'skillCounter':c,'fatCounter':struct.unpack('<I',uc.mem_read(0x1007bea24,4))[0],'healthCounter':struct.unpack('<I',uc.mem_read(0x1007bea34,4))[0],'messageState':uc.mem_read(0x1009335f8,1)[0],'external':events.copy()}
rows=[]
for boost in [False,True]:
 for gas in [-1,0,1]:
  for wheels in [0,2]:
   for velocity in [(0,0,0),(.1,0,0),(.2,0,0),(.3,.1,.1)]:
    for counters in [(0,0),(300000,120000),(300001,120001)]:rows.append(run(boost,gas,velocity,wheels,*counters))
for boost in [False,True]:
 for gas in [0,1]:
  for energy in [0,-1]:rows.append(run(boost,gas,(.3,0,0),0,300001,120001,energy=energy,fatCounter=150001,healthCounter=600001))
for amount in [-1,0,.5,1,1.0001,50]:rows.append(run(True,1,(.3,0,0),2,300001,120001,overrides={0:amount,6:amount}))
for ts in [0,.01,.5,1,50/30,3,6,214748.36]:
 for boost in [False,True]:
  for wheels in [0,1,2]:rows.append(run(boost,1,(.3,.1,-.05),wheels,0,0,ts=ts))
for counter in [0xffffff00,0xffffffff,16777215,16777216,16777217]:
 for boost in [False,True]:rows.append(run(boost,1,(.3,0,0),2,counter,counter,overrides={33:5000000,39:5000000}))
for skill in [-2147483648,-16777217,949,950,999,1000,2147483647]:
 for gain in [.5,1.0001,50,2147483648]:rows.append(run(True,1,(.3,0,0),2,0,120001,skill=skill,overrides={6:gain}))
for speed in [.04999999,.05,.05000001,.19999999,.2,.20000001]:
 for wheels in [0,2]:rows.append(run(False,0,(speed,0,0),wheels,0,0))
for message in [1,2,3]:rows.append(run(True,1,(.3,0,0),2,300001,120001,fatCounter=150001,healthCounter=600001,messageState=message))
if args.profiles:
 for i in json.loads(args.profiles.read_text()):
  rows.append(run(i['boost'],i['gas'],i['velocity'],i['wheels'],i['staminaCounter'],i['skillCounter'],ts=i['timeStep'],fat=i['fat'],stamina=i['stamina'],muscle=i['muscle'],health=i['maxHealth'],skill=i['skill'],energy=i['energy'],fatCounter=i['fatCounter'],healthCounter=i['healthCounter'],show=i['showUpdates'],overrides=i.get('overrides'),messageState=i.get('messageState',0)))
# Selected CBike contact-count loop, four suspension lines; no external calls.
contactCases=[]
for mask in range(16):
 bike=0x20000000;uc.mem_write(bike,bytes(0x1000));ratios=[.5 if mask&(1<<i) else 1.0 for i in range(4)]
 uc.mem_write(bike+0x900,struct.pack('<4f',*ratios));uc.reg_write(UC_ARM64_REG_X19,bike);uc.reg_write(UC_ARM64_REG_X9,0);uc.reg_write(UC_ARM64_REG_S8,0x3f800000);uc.reg_write(UC_ARM64_REG_S1,0x3f800000)
 uc.emu_start(0x1004528e0,0x1004529ac,count=1000)
 if uc.reg_read(UC_ARM64_REG_PC)!=0x1004529ac:raise RuntimeError('Contact loop did not reach its continuation.')
 contactCases.append({'mask':mask,'ratios':ratios,'contactPoints':uc.mem_read(bike+0xa08,1)[0]})
args.output.write_text(json.dumps({'source':'Complete selected CStats::UpdateStatsWhenCycling and actual UpdateFatAndMuscleStats; logged CheckForStatsMessage/DisplayScriptStatUpdateMessage stubs','sha256':sha256,'function':'0x100265770','body':'0x100265280','configuration':values,'contactCases':contactCases,'contactEntry':'0x1004528e0','contactContinuation':'0x1004529ac','arStatsSha256':hashlib.sha256(config).hexdigest(),'cases':rows},indent=2)+'\n');print(json.dumps({'cases':len(rows),'speedSquaredThresholds':[struct.unpack('<f',data(a,4))[0] for a in [0x100592d64,0x10059366c]],'boostThreshold':struct.unpack('<f',data(0x1005908cc,4))[0]}))
