"""Capture complete selected CStats::UpdateStatsWhenDriving.

Counter, speed/wheel branches and raw integer-stat writes execute unchanged.
Only CheckForStatsMessage and DisplayScriptStatUpdateMessage are logged stubs.
Vehicle velocity, native type and wheel contacts are declared input fields.
Uses packaged AR_STATS.DAT and the pinned binary, without a download.
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
def run(counter,velocity=(0,0,0),wheels=4,vehicleType=0,skill=0,ts=50/30,overrides=None,show=True):
 global events
 events=[];v=values.copy()
 for key,value in (overrides or {}).items():v[int(key)]=value
 uc.mem_write(0x1007bdea8,struct.pack('<59f',*v));uc.mem_write(0x1007bdb2c+40*4,struct.pack('<i',skill));uc.mem_write(0x1007bea14,struct.pack('<I',counter));uc.mem_write(0x1007c44a0,struct.pack('<f',ts));uc.mem_write(0x10064a04c,bytes([int(show)]))
 uc.mem_write(0x20000000+0x68,struct.pack('<fff',*velocity));uc.mem_write(0x20000000+0x734,struct.pack('<I',vehicleType));uc.mem_write(0x20000000+0xb94,bytes([wheels]));uc.reg_write(UC_ARM64_REG_X0,0x20000000);uc.reg_write(UC_ARM64_REG_SP,0x2000e000);uc.reg_write(UC_ARM64_REG_LR,0x2000f000);uc.emu_start(0x100265c70,0x2000f000,count=2000)
 if uc.reg_read(UC_ARM64_REG_PC)!=0x2000f000:raise RuntimeError('Driving routine did not return.')
 return {'input':{'counter':counter,'velocity':[f(x) for x in velocity],'wheels':wheels,'vehicleType':vehicleType,'skill':skill,'timeStep':f(ts),'overrides':overrides or {},'showUpdates':show},'counter':struct.unpack('<I',uc.mem_read(0x1007bea14,4))[0],'skill':struct.unpack('<i',uc.mem_read(0x1007bdb2c+40*4,4))[0],'external':events.copy()}
rows=[]
for vehicleType in [0,1]:
 for wheels in [0,2,4]:
  for velocity in [(0,0,0),(.19999,0,0),(.2,0,0),(.20001,0,0),(.79999,0,0),(.8,0,0),(.80001,0,0),(.3,.4,.1)]:
   for counter in [0,300000,300001]:
    for skill in [0,999]:rows.append(run(counter,velocity,wheels,vehicleType,skill))
for skill in [-2147483648,-100,-1,1000,16777217,2147483610,2147483647]:rows.append(run(300001,(.6,0,0),skill=skill))
for amount in [-1,0,.5,1,1.0001,20,1e10]:
 for show in [False,True]:rows.append(run(300001,(.6,0,0),overrides={4:amount},show=show))
for counter in [16777215,16777216,16777217,0xfffffffe,0xffffffff]:
 for ts in [.5,50/60,50/30,1e8]:rows.append(run(counter,(.6,0,0),ts=ts,overrides={37:1e9}))
for counter in [16777215,16777216,16777217]:rows.append(run(counter,(.6,0,0),overrides={37:16777.216}))
if args.profiles:
 for profile in json.loads(args.profiles.read_text()):
  i=profile.get('input',profile)
  rows.append(run(i['counter'],i['velocity'],i['wheels'],i['vehicleType'],i['skill'],i['timeStep'],i.get('overrides'),i['showUpdates']))
args.output.write_text(json.dumps({'source':'Complete selected CStats::UpdateStatsWhenDriving with actual counter and integer-stat writes; logged CheckForStatsMessage/DisplayScriptStatUpdateMessage stubs','sha256':sha256,'function':'0x100265c70','configuration':values,'arStatsSha256':hashlib.sha256(config).hexdigest(),'cases':rows},indent=2)+'\n');print(json.dumps({'cases':len(rows),'speedThresholds':[struct.unpack('<f',data(addr,4))[0] for addr in [0x10058ca08,0x10058ca0c]]}))
