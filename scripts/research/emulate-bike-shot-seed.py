"""Capture native bike/quad drive-by muzzle, frame lead and pre-auto-aim ray.

Weapon info, hand/vehicle matrices, velocity, timestep, hierarchy lookup and
three CRT draws are declared inputs. Native RW vector dispatch setup and the
actual point-transform callback execute. Stops before automatic aiming and
impact processing, without stubbing any selected arithmetic.
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

from unicorn import UC_HOOK_CODE,UC_HOOK_MEM_INVALID
import math
uc=Uc(UC_ARCH_ARM64,UC_MODE_ARM)
for page in [0x100497000,0x100498000,0x10039d000,0x10010c000,0x10049d000,0x1000f7000,0x1000f8000,0x10058c000,0x10058f000,0x100592000,0x100596000]:
 uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
for page in [0x1007c4000,0x1004ed000,0x10065e000,0x100923000]:uc.mem_map(page,0x1000)
uc.mem_map(0x20000000,0x10000)
vehicle,weapon,info,ped,matrix,hierarchy,bones,boneInfo,rwGlobals=0x20000000,0x20001000,0x20001100,0x20002000,0x20003000,0x20004000,0x20004100,0x20004300,0x20005000
profile={};drawAt=0;events=[]
def f(x):return struct.unpack('<f',struct.pack('<f',x))[0]
def hook(uc,addr,size,user):
 global drawAt
 if addr in [0x10049db10,0x10039d0ac,0x10010c698,0x10010c650,0x1004ed718]:
  if addr==0x10049db10:value=info
  elif addr==0x10039d0ac:value=hierarchy
  elif addr==0x10010c698:value=0;events.append({'boneId':uc.reg_read(UC_ARM64_REG_W1)})
  elif addr==0x10010c650:value=bones
  else:value=profile['random'][drawAt];drawAt+=1
  uc.reg_write(UC_ARM64_REG_X0,value);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR));return
uc.hook_add(UC_HOOK_CODE,hook)
def fault(uc,access,addr,size,value,user):print('fault',hex(uc.reg_read(UC_ARM64_REG_PC)),hex(addr));return False
uc.hook_add(UC_HOOK_MEM_INVALID,fault)
def writeMatrix(ptr,rows):
 for i,row in enumerate(rows):uc.mem_write(ptr+i*16,struct.pack('<4f',*row,1 if i==3 else 0))
def capture(vehicleMatrix,handMatrix,velocity=[.1,.05,.02],fireOffset=[.1,.3,.05],range=35,timeStep=.8333333,left=False,right=False,vehicleType=9,random=[128,128,128]):
 global profile,drawAt
 profile={'random':random};drawAt=0;events.clear();uc.mem_write(vehicle,bytes(0x10000));writeMatrix(matrix,vehicleMatrix);writeMatrix(bones,handMatrix);uc.mem_write(vehicle+0x18,struct.pack('<Q',matrix));uc.mem_write(vehicle+0x5a0,struct.pack('<Q',ped));uc.mem_write(vehicle+0x734,struct.pack('<I',vehicleType));uc.mem_write(vehicle+0x68,struct.pack('<3f',*velocity));uc.mem_write(ped+0x20,struct.pack('<Q',0x20004400));uc.mem_write(ped+0x5c8,struct.pack('<Q',boneInfo));uc.mem_write(boneInfo+0x18,struct.pack('<I',24));uc.mem_write(weapon,struct.pack('<I',28));uc.mem_write(info+8,struct.pack('<f',range));uc.mem_write(info+0x24,struct.pack('<3f',*fireOffset));uc.mem_write(0x1007c44a0,struct.pack('<f',timeStep));uc.mem_write(0x10065e410,struct.pack('<Q',rwGlobals))
 # Native vector-module setup chooses the actual point-transform callback.
 uc.reg_write(UC_ARM64_REG_SP,0x2000f000);uc.reg_write(UC_ARM64_REG_X0,rwGlobals);uc.reg_write(UC_ARM64_REG_W1,0x100);uc.emu_start(0x1000f8780,0x1000f87fc,count=1000)
 uc.reg_write(UC_ARM64_REG_SP,0x2000f000);uc.reg_write(UC_ARM64_REG_X0,weapon);uc.reg_write(UC_ARM64_REG_X1,vehicle);uc.reg_write(UC_ARM64_REG_W2,int(left));uc.reg_write(UC_ARM64_REG_W3,int(right));uc.reg_write(UC_ARM64_REG_LR,0x2000e000);uc.emu_start(0x100497a48,0x100498044,count=10000)
 if uc.reg_read(UC_ARM64_REG_PC)!=0x100498044:raise RuntimeError('Shot seed did not reach the auto-aim call setup.')
 sp=uc.reg_read(UC_ARM64_REG_SP)
 return {'input':{'vehicleMatrix':vehicleMatrix,'handMatrix':handMatrix,'velocity':list(map(f,velocity)),'fireOffset':list(map(f,fireOffset)),'range':f(range),'timeStep':f(timeStep),'left':left,'right':right,'vehicleType':vehicleType,'random':random},'start':list(struct.unpack('<3f',uc.mem_read(sp+0x10,12))),'end':list(struct.unpack('<3f',uc.mem_read(sp+0x20,12))),'draws':drawAt,'events':events.copy()}
def basis(yaw,position,tilt=0):
 c,s,ct,st=math.cos(yaw),math.sin(yaw),math.cos(tilt),math.sin(tilt)
 return [[f(c),f(s),0],[f(-s*ct),f(c*ct),f(st)],[f(s*st),f(-c*st),f(ct)],list(map(f,position))]
rows=[]
for yaw in [0,.7,2]:
 for tilt in [0,.4]:
  for kind in [0,9]:
   for left,right in [(False,False),(True,False),(False,True),(True,True)]:
    for ts in [0,.8333333,2]:
     for draw in [[0,127,255],[128,128,128],[255,0,128]]:
      rows.append(capture(basis(yaw,[100,200,10]),basis(yaw+.3,[100.2,200.3,11],tilt),timeStep=ts,left=left,right=right,vehicleType=kind,random=draw))
if args.profiles:
 for row in json.loads(args.profiles.read_text()):rows.append(capture(**row['nativeInput']))
args.output.write_text(json.dumps({'source':'Actual FireInstantHitFromCar muzzle transform, frame lead, base direction and three-draw scatter before auto-aim. Declared hand/vehicle matrices, weapon fields, velocity, timestep, CRT draws and hierarchy lookup. Native RW vector dispatch initialized by module-open prefix; actual default point transform executes. Stops before DoDriveByAutoAiming/impacts','sha256':sha256,'entry':'0x100497a48','stop':'0x100498044','rightOffsetScale':struct.unpack('<f',data(0x100592c04,4))[0],'rightOffsetZ':struct.unpack('<f',data(0x10058fd48,4))[0],'spreadScale':struct.unpack('<f',data(0x10058ca00,4))[0],'spreadBias':struct.unpack('<f',data(0x100596828,4))[0],'cases':rows},indent=2)+'\n');print(json.dumps({'cases':len(rows)}))
