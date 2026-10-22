"""Capture object detachment activation, inherited/ejected motion and attachment stores."""
import hashlib,json,struct,sys
from pathlib import Path
from unicorn import Uc,UC_ARCH_ARM64,UC_MODE_ARM,UC_HOOK_CODE
from unicorn.arm64_const import *
f=Path(sys.argv[1]).read_bytes()
assert hashlib.sha256(f).hexdigest()=='9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78','Unexpected executable hash'
slice_offset=next(struct.unpack_from('>I',f,8+i*20+8)[0]for i in range(struct.unpack_from('>I',f,4)[0])if struct.unpack_from('>I',f,8+i*20)[0]==0x0100000c)
u=Uc(UC_ARCH_ARM64,UC_MODE_ARM);at=slice_offset+32
for _ in range(struct.unpack_from('<I',f,slice_offset+16)[0]):
 cmd,size=struct.unpack_from('<II',f,at)
 if cmd==0x19:
  vm,vm_size,off,length=struct.unpack_from('<QQQQ',f,at+24)
  if vm:u.mem_map(vm,(vm_size+4095)&~4095);u.mem_write(vm,f[slice_offset+off:slice_offset+off+length])
 at+=size



import math
SCRATCH=0x200000000;u.mem_map(SCRATCH,0x80000);OBJECT=SCRATCH+0x1000;PARENT=SCRATCH+0x3000;MATRIX=SCRATCH+0x5000;VTABLE=SCRATCH+0x6000;STATIC=SCRATCH+0x100;INFO=SCRATCH+0x7000;OWN_MATRIX=SCRATCH+0x8000
u.mem_write(VTABLE+0x28,struct.pack('<Q',STATIC));events=[];rows=[]
f32=lambda n:struct.unpack('<f',struct.pack('<f',n))[0]
def sf(reg):return struct.unpack('<f',struct.pack('<I',u.reg_read(reg)))[0]
def wf(reg,n):u.reg_write(reg,struct.unpack('<I',struct.pack('<f',n))[0])
def hook(uc,addr,size,user):
 if addr in [0x10026e5dc,0x10026e754]:events.append('remove' if addr==0x10026e5dc else 'add')
 elif addr==STATIC:events.append({'setStatic':bool(uc.reg_read(UC_ARM64_REG_W1))})
 elif addr==0x1004ecaf4:
  a=sf(UC_ARM64_REG_S0);wf(UC_ARM64_REG_S0,math.sin(a));wf(UC_ARM64_REG_S1,math.cos(a))
 elif addr==0x100248328:events.append({'turnForce':[sf(r)for r in [UC_ARM64_REG_S0,UC_ARM64_REG_S1,UC_ARM64_REG_S2]],'point':[sf(r)for r in [UC_ARM64_REG_S3,UC_ARM64_REG_S4,UC_ARM64_REG_S5]]});return
 elif 0x1002526a0<=addr<0x1002529d8 or 0x1002c9000<=addr<0x1002cb300 or 0x100248328<=addr<0x100248420:return
 else:raise RuntimeError('Unhandled call '+hex(addr))
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
u.hook_add(UC_HOOK_CODE,hook)
for basis in [[[1,0,0],[0,1,0],[0,0,1]],[[0,1,0],[-1,0,0],[0,0,1]],[[1,0,0],[0,.6,.8],[0,-.8,.6]]]:
 for velocity in [[0,0,0],[.1,-.2,.3]]:
  for angles in [[0,0,0],[0,0,.1],[30,-45,.2],[-90,90,1]]:
   for turn in [False,True]:
    for centre in [[0,0,0],[0,.2,-.1]]:
     u.mem_write(OBJECT,bytes(0x1000));u.mem_write(PARENT,bytes(0x1000));u.mem_write(MATRIX,bytes(0x100));u.mem_write(OWN_MATRIX,bytes(0x100));u.mem_write(OBJECT,struct.pack('<Q',VTABLE));u.mem_write(OBJECT+0x5a,b'\x04');u.mem_write(OBJECT+0x64,struct.pack('<I',1<<25));u.mem_write(OBJECT+0x68,struct.pack('<fff',9,8,7));u.mem_write(OBJECT+0x74,struct.pack('<fff',.01,.02,.03));u.mem_write(OBJECT+0x150,struct.pack('<Q',PARENT));u.mem_write(OBJECT+0x1c4,struct.pack('<Q',INFO));u.mem_write(PARENT+0x5a,b'\x02');u.mem_write(PARENT+0x18,struct.pack('<Q',MATRIX));u.mem_write(PARENT+0x68,struct.pack('<fff',*velocity));u.mem_write(OBJECT+0x18,struct.pack('<Q',OWN_MATRIX))
     for index,vector in enumerate(basis):u.mem_write(MATRIX+index*16,struct.pack('<fff',*vector))
     u.mem_write(OBJECT+0xb0,struct.pack('<ff',25,50));u.mem_write(OBJECT+0xc8,struct.pack('<fff',*centre))
     for index,vector in enumerate([[1,0,0],[0,1,0],[0,0,1]]):u.mem_write(OWN_MATRIX+index*16,struct.pack('<fff',*vector))
     events=[]
     for reg,value in [(UC_ARM64_REG_X0,OBJECT),(UC_ARM64_REG_W1,int(turn)),(UC_ARM64_REG_SP,SCRATCH+0x7f000),(UC_ARM64_REG_LR,SCRATCH)]:u.reg_write(reg,value)
     wf(UC_ARM64_REG_S0,f32(f32(f32(angles[0])*f32(math.pi))/180));wf(UC_ARM64_REG_S1,f32(f32(f32(angles[1])*f32(-math.pi))/180));wf(UC_ARM64_REG_S2,angles[2])
     u.emu_start(0x1002526a0,SCRATCH,count=10000)
     rows.append({'input':{'basis':basis,'velocity':velocity,'angles':angles,'turn':turn,'centreOfMass':centre,'turnMass':50},'native':{'velocity':list(struct.unpack('<fff',u.mem_read(OBJECT+0x68,12))),'turnSpeed':list(struct.unpack('<fff',u.mem_read(OBJECT+0x74,12))),'attached':struct.unpack('<Q',u.mem_read(OBJECT+0x150,8))[0]!=0,'attachmentBytes':bytes(u.mem_read(OBJECT+0x158,0x28)).hex(),'ignoredParent':struct.unpack('<Q',u.mem_read(OBJECT+0x180,8))[0]==PARENT,'attachedFlag':bool(struct.unpack('<I',u.mem_read(OBJECT+0x64,4))[0]&(1<<25)),'events':events}})
print(json.dumps({'executableSha256':hashlib.sha256(f).hexdigest(),'function':'0x1002526a0','scope':'Normal object collision-force flags and existing parent matrix; world remove/add, virtual SetIsStatic and sincosf intercepted; native matrix composition, ApplyTurnForce, COM transform, cross product and all detachment stores execute','cases':rows},indent=2))
