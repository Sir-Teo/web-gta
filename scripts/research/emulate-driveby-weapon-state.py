"""Capture actual FireFromCar and owner-null CWeapon::Update ammo/state writes.

Instant-hit effects, audio, player lookup, percentage completion, weapon info
and reload duration are declared external services. Optional caller timestamp
overwrite is declared. No selected ammo/state arithmetic is stubbed. The iOS
FireFromCar branch accepts states 0/1 and ignores instant-hit's return value.
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
for page in [0x100497000,0x10049a000,0x10049b000,0x10049d000,0x10058c000]:
 uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
for page in [0x10014f000,0x100256000,0x100261000,0x100284000,0x10071d000,0x1007c4000]:uc.mem_map(page,0x1000)
uc.mem_map(0x20000000,0x10000)
weapon,vehicle,owner,info=0x20000000,0x20001000,0x20002000,0x20003000
profile={};events=[]
def hook(uc,addr,size,user):
 if addr not in [0x100497a48,0x10014fb70,0x100256130,0x100261c30,0x10049db10,0x10049dbf8,0x100284944]:return
 value=0
 if addr==0x100497a48:events.append('shot');value=int(profile['hitReturn'])
 elif addr==0x10014fb70:events.append('audio')
 elif addr==0x10049db10:value=info
 elif addr==0x10049dbf8:value=profile['reloadMs']
 elif addr==0x100261c30:uc.reg_write(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',profile['progress']))[0])
 uc.reg_write(UC_ARM64_REG_X0,value);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
uc.hook_add(UC_HOOK_CODE,hook)
def invoke(entry):
 uc.reg_write(UC_ARM64_REG_SP,0x2000f000);uc.reg_write(UC_ARM64_REG_X0,weapon);uc.reg_write(UC_ARM64_REG_X1,vehicle if entry==0x100497908 else 0);uc.reg_write(UC_ARM64_REG_W2,0);uc.reg_write(UC_ARM64_REG_W3,0);uc.reg_write(UC_ARM64_REG_LR,0x2000e000);uc.emu_start(entry,0x2000e000,count=5000)
 if uc.reg_read(UC_ARM64_REG_PC)!=0x2000e000:raise RuntimeError('Weapon did not return')
 return bool(uc.reg_read(UC_ARM64_REG_W0))
def snapshot():
 kind,state,clip,total,nextShot=struct.unpack('<5I',uc.mem_read(weapon,20));return {'state':state,'clip':clip,'total':total,'nextShot':nextShot}
def capture(operation="fire",state=0,clip=30,total=100,nextShot=0,timeMs=100,updateTime=None,callerDelay=None,infinite=False,progress=0,entityByte=2,driver=True,hitReturn=True,reloadMs=1000,magazine=30):
 global profile
 profile=locals().copy();events.clear();uc.mem_write(weapon,bytes(0x10000));uc.mem_write(weapon,struct.pack('<5I',28,state,clip,total,nextShot));uc.mem_write(vehicle+0x5a0,struct.pack('<Q',owner if driver else 0));uc.mem_write(vehicle+0x5a,bytes([entityByte]));uc.mem_write(info,struct.pack('<I',1));uc.mem_write(info+0x20,struct.pack('<h',magazine));uc.mem_write(0x10071d7d8,bytes([int(infinite)]));uc.mem_write(0x1007c4478,struct.pack('<I',timeMs))
 if operation=="fire":result=invoke(0x100497908)
 else:invoke(0x10049adf8);result=None
 if callerDelay is not None and operation=="fire":uc.mem_write(weapon+0x10,struct.pack('<I',(timeMs+callerDelay)&0xffffffff))
 fired=snapshot()
 if updateTime is not None:uc.mem_write(0x1007c4478,struct.pack('<I',updateTime));invoke(0x10049adf8)
 return {'input':{k:v for k,v in profile.items() if k!='profile'},'fired':fired,'updated':snapshot(),'result':result,'events':events.copy()}
rows=[]
for state in range(5):
 for clip in [0,1,2,30]:
  for total in [0,1,2,100,24999,25000,25001]:
   for infinite in [False,True]:rows.append(capture(state=state,clip=clip,total=total,infinite=infinite))
for progress in [99.999,100,101]:
 for entityByte in [2,10,18]:
  for total in [1,24999,25000]:rows.append(capture(progress=progress,entityByte=entityByte,total=total))
for clip in [1,2]:
 for now in [169,170,171]:rows.append(capture(clip=clip,total=100,callerDelay=70,updateTime=now))
rows.extend([capture(hitReturn=False),capture(driver=False),capture(timeMs=0xfffffff0,callerDelay=70,updateTime=55)])
for state in range(5):
 for clip in [0,1,30]:
  for total in [0,1,15,100]:
   for now in [99,100,101]:rows.append(capture(operation='update',state=state,clip=clip,total=total,nextShot=100,timeMs=now))
if args.profiles:
 for row in json.loads(args.profiles.read_text()):rows.append(capture(**row['nativeInput']))
args.output.write_text(json.dumps({'sha256':sha256,'fireEntry':'0x100497908','updateEntry':'0x10049adf8','source':'Actual FireFromCar and owner-null CWeapon::Update, with declared impact/audio/player lookup/stats/weapon-info/reload-time services. Optional caller timestamp overwrite declared.','cases':rows},indent=2)+'\n');print(json.dumps({'cases':len(rows)}))
