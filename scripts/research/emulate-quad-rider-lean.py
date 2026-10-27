"""Capture CQuadBike::ProcessAI rider lean arithmetic (0x10046eda4).

Prepared prior lean, steering angle/lock, handling values, timestep and the
preceding native s8=1 are declared inputs. Only imported host-libm powf is
external; all selected ARM64 arithmetic executes. Vehicle/player/task gating,
input processing and preceding turn forces are outside this leaf capture.
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
import ctypes
libm=ctypes.CDLL('libm.so.6');libm.powf.argtypes=[ctypes.c_float,ctypes.c_float];libm.powf.restype=ctypes.c_float
uc=Uc(UC_ARCH_ARM64,UC_MODE_ARM)
for page in [0x10046e000,0x10058c000,0x10058e000]:
 uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
uc.mem_map(0x1007c4000,0x1000);uc.mem_map(0x1004ed000,0x1000);uc.mem_map(0x20000000,0x4000)
vehicle,handling,engine=0x20000000,0x20001000,0x20002000
power=[]
def f(x):return struct.unpack('<f',struct.pack('<f',x))[0]
def hook(uc,addr,size,user):
 if addr!=0x1004ed5e0:return
 a,b=[struct.unpack('<f',struct.pack('<I',uc.reg_read(reg)))[0] for reg in [UC_ARM64_REG_S0,UC_ARM64_REG_S1]];result=libm.powf(a,b);power.append({'base':a,'exponent':b,'result':result});uc.reg_write(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',result))[0]);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
uc.hook_add(UC_HOOK_CODE,hook)
def capture(current,steerAngle,steerLock,fullAnimLean,desLean,timeStep):
 power.clear();uc.mem_write(vehicle,bytes(0x3000));uc.mem_write(vehicle+0xbc8,struct.pack('<Q',handling));uc.mem_write(vehicle+0x4a8,struct.pack('<Q',engine));uc.mem_write(vehicle+0xbd8,struct.pack('<f',current));uc.mem_write(vehicle+0x600,struct.pack('<f',steerAngle));uc.mem_write(handling+0x18,struct.pack('<ff',fullAnimLean,desLean));uc.mem_write(engine+0xa0,struct.pack('<f',steerLock));uc.mem_write(0x1007c44a0,struct.pack('<f',timeStep));uc.reg_write(UC_ARM64_REG_X19,vehicle);uc.reg_write(UC_ARM64_REG_S8,0x3f800000)
 uc.emu_start(0x10046eda4,0x10046ee04,count=1000)
 return {'input':dict(zip(['current','steerAngle','steerLock','fullAnimLean','desLean','timeStep'],map(f,[current,steerAngle,steerLock,fullAnimLean,desLean,timeStep]))),'lean':struct.unpack('<f',uc.mem_read(vehicle+0xbd8,4))[0],'powerCalls':power.copy()}
rows=[]
for current in [-.8,0,.8]:
 for steer in [-.7,-.3,0,.3,.7]:
  for des in [.5,.88,.95,1]:
   for ts in [0,.5,.8333333,1,2,4]:rows.append(capture(current,steer,35,.7504916,des,ts))
for lock in [20,45]:
 for full in [.5235988,.9]:
  for angle in [-.6,0,.6]:
   for ts in [.5,1,4]:rows.append(capture(.5,angle,lock,full,.88,ts))
if args.profiles:
 for row in json.loads(args.profiles.read_text()):rows.append(capture(**row['nativeInput']))
args.output.write_text(json.dumps({'source':'CQuadBike rider lean arithmetic only, declared prior lean/steering/handling/timestep and s8=1; imported host-libm powf boundary','sha256':sha256,'entry':'0x10046eda4','stop':'0x10046ee04','degreeRadiansNumerator':struct.unpack('<f',data(0x10058e7e4,4))[0],'degreeRadiansDivisor':struct.unpack('<f',data(0x10058c830,4))[0],'cases':rows},indent=2)+'\n');print(json.dumps({'cases':len(rows)}))
