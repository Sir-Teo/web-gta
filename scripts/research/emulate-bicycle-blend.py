"""Capture native BlendAnimation plus actual SyncAnimation/Start/SetCurrentTime.

Static descriptor lookups, zero-node allocation and asset decompression are
declared stubs. Blend/flag/list changes and sync/time arithmetic execute in
the pinned native code. This is scalar association work, not pose sampling.
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
for page in [0x10013c000,0x10013d000,0x100138000,0x100139000,0x10058e000]:uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
uc.mem_map(0x100689000,0x2000);uc.mem_map(0x20000000,0x20000)
clump,clumpData,groups,static,stack=0x20000000,0x20000100,0x20000200,0x20000400,0x2001f000
pointers={};events=[];created=[];group=3;nextIndex=0
def f(x):return struct.unpack('<f',struct.pack('<f',x))[0]
def flags(identifier):return struct.unpack('<II',data(0x1006248b0+(identifier-194)*8,8))[1]
def initAssoc(identifier,amount=0,delta=0,time=0,speed=1,duration=.73333335,otherGroup=3):
 global nextIndex
 ptr=0x20001000+nextIndex*0x100;hier=0x20010000+nextIndex*0x100;nextIndex+=1
 uc.mem_write(ptr,bytes(0x100));uc.mem_write(hier,bytes(0x100));uc.mem_write(ptr+0x1a,struct.pack('<h',otherGroup));uc.mem_write(ptr+0x28,struct.pack('<Q',hier));uc.mem_write(ptr+0x30,struct.pack('<ffff',amount,delta,time,speed));uc.mem_write(ptr+0x44,struct.pack('<HH',identifier,flags(identifier)|1));uc.mem_write(hier+0x18,struct.pack('<f',duration));pointers[ptr]=identifier;return ptr
profile={}
def hook(uc,addr,size,unused):
 if addr==0x100138804:
  identifier=uc.reg_read(UC_ARM64_REG_W1);uc.mem_write(static+0xe,struct.pack('<H',flags(identifier)));uc.reg_write(UC_ARM64_REG_X0,static)
 elif addr==0x1001388b4:
  identifier=uc.reg_read(UC_ARM64_REG_W1);ptr=initAssoc(identifier,duration=profile['duration']);created.append(ptr);uc.reg_write(UC_ARM64_REG_X0,ptr)
 elif addr==0x10013cefc:events.append('UncompressAnimation')
 else:return
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
uc.hook_add(UC_HOOK_CODE,hook)
def run(request,associations,duration=.6666667,blend=4):
 global pointers,events,created,nextIndex,profile
 pointers={};events=[];created=[];nextIndex=0;profile={'duration':duration};uc.mem_write(clump,bytes(0x20000));uc.mem_write(0x10068acb4,struct.pack('<i',0x70));uc.mem_write(0x100689fa0,struct.pack('<Q',groups));uc.mem_write(clump+0x70,struct.pack('<Q',clumpData));addresses=[initAssoc(**a) for a in associations]
 for i,p in enumerate(addresses):uc.mem_write(p+8,struct.pack('<QQ',addresses[i+1]+8 if i+1<len(addresses) else 0,addresses[i-1]+8 if i else clumpData))
 uc.mem_write(clumpData,struct.pack('<Q',addresses[0]+8 if addresses else 0));uc.reg_write(UC_ARM64_REG_SP,stack);uc.reg_write(UC_ARM64_REG_X0,clump);uc.reg_write(UC_ARM64_REG_W1,group);uc.reg_write(UC_ARM64_REG_W2,request);uc.reg_write(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',blend))[0]);uc.reg_write(UC_ARM64_REG_LR,0x2001e000);uc.emu_start(0x10013d5dc,0x2001e000,count=3000)
 if uc.reg_read(UC_ARM64_REG_PC)!=0x2001e000:raise RuntimeError('Native BlendAnimation did not return.')
 order=[];p=struct.unpack('<Q',uc.mem_read(clumpData,8))[0]
 while p:
  ptr=p-8;order.append({'identifier':pointers[ptr],'new':ptr in created,'amount':struct.unpack('<f',uc.mem_read(ptr+0x30,4))[0],'delta':struct.unpack('<f',uc.mem_read(ptr+0x34,4))[0],'time':struct.unpack('<f',uc.mem_read(ptr+0x38,4))[0],'speed':struct.unpack('<f',uc.mem_read(ptr+0x3c,4))[0],'flags':struct.unpack('<H',uc.mem_read(ptr+0x46,2))[0]});p=struct.unpack('<Q',uc.mem_read(p,8))[0]
  if len(order)>10:raise RuntimeError('Association chain did not terminate.')
 return {'input':{'request':request,'associations':associations,'duration':f(duration),'blend':f(blend)},'returned':pointers[uc.reg_read(UC_ARM64_REG_X0)],'associations':order,'events':events}
rows=[]
for request in [207,208]:
 other=208 if request==207 else 207
 for amount in [0,.01,.25,.5,1]:
  for delta in [-4,0,4]:
   rows.append(run(request,[{'identifier':other,'amount':amount,'delta':delta,'time':.2,'speed':.6}]))
   rows.append(run(request,[{'identifier':request,'amount':amount,'delta':delta,'time':.2,'speed':.6},{'identifier':other,'amount':1-amount,'delta':-delta,'time':.3,'duration':.6666667}]))
 for time in [0,.2,.73333335]:rows.append(run(request,[{'identifier':request,'amount':1,'time':time}]))
 rows.append(run(request,[]))
 rows.append(run(request,[{'identifier':194,'amount':1,'duration':.033333335}]))
for request in [207,208]:
 other=208 if request==207 else 207
 for amount in [.0001,.01,.0125,.1,.5,1]:
  for delta in [-4,-.05,-amount*4,0,4]:rows.append(run(request,[{'identifier':other,'amount':amount,'delta':delta,'time':.2}]))
 for time in [.7333333,.73333335,.7333334]:rows.append(run(request,[{'identifier':request,'amount':1,'time':time}]))
 rows.append(run(request,[{'identifier':request,'amount':.5,'time':.2,'otherGroup':4}]))
rows.append(run(194,[{'identifier':207,'amount':.5},{'identifier':194,'amount':.5}]))
args.output.write_text(json.dumps({'source':'Native BlendAnimation with actual SyncAnimation/Start/SetCurrentTime; declared static descriptors and zero-node allocation, UncompressAnimation stub','sha256':sha256,'function':'0x10013d5dc','descriptorTable':'0x1006248b0','cases':rows},indent=2)+'\n');print(json.dumps({'cases':len(rows)}))
