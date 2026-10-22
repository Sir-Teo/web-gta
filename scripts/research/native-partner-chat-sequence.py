"""Capture native approach points and unavailable-conversation fallback sequences."""
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



SCRATCH=0x200000000;u.mem_map(SCRATCH,0x80000);TASK=SCRATCH+0x1000;PED=SCRATCH+0x3000;PARTNER=SCRATCH+0x5000;VT=SCRATCH+0xa000;TYPE=SCRATCH+0x100;ALLOC=SCRATCH+0x10000
u.mem_write(VT+0x28,struct.pack('<Q',TYPE));rows=[];events=[];allocation=ALLOC;objects={}
def hook(uc,addr,size,user):
 global allocation
 if addr==TYPE:uc.reg_write(UC_ARM64_REG_W0,1204)
 elif addr==0x1003a6ccc:
  allocation+=0x100;uc.mem_write(allocation,bytes(0x100));uc.reg_write(UC_ARM64_REG_X0,allocation)
 elif addr==0x1003c3e54:pass
 elif addr==0x10035a870:uc.reg_write(UC_ARM64_REG_X0,SCRATCH+0x7000)
 elif addr==0x10040c09c:objects[uc.reg_read(UC_ARM64_REG_X0)]={'kind':'turn'}
 elif addr==0x1003be260:objects[uc.reg_read(UC_ARM64_REG_X0)]={'kind':'stand','ms':uc.reg_read(UC_ARM64_REG_W1)}
 elif addr==0x1003a7988:objects[uc.reg_read(UC_ARM64_REG_X0)]={'kind':'chat','ms':uc.reg_read(UC_ARM64_REG_W3),'animation':uc.reg_read(UC_ARM64_REG_W2)}
 elif addr==0x1003c40fc:events.append(objects[uc.reg_read(UC_ARM64_REG_X1)])
 elif 0x100421468<=addr<0x10042180c or 0x10042012c<=addr<0x100420308 or 0x1002cb4c4<=addr<0x1002cb518:return
 else:raise RuntimeError('Unhandled call '+hex(addr))
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
u.hook_add(UC_HOOK_CODE,hook)
def run(fn):
 for reg,value in [(UC_ARM64_REG_X0,TASK),(UC_ARM64_REG_X1,PED),(UC_ARM64_REG_X2,TASK+0x54),(UC_ARM64_REG_X3,TASK+0x60),(UC_ARM64_REG_SP,SCRATCH+0x7f000),(UC_ARM64_REG_LR,SCRATCH)]:u.reg_write(reg,value)
 u.emu_start(fn,SCRATCH,count=4000)
for a,b in [([0,0,0],[0,0,0]),([10,20,30],[16,28,30]),([-2238.95,120.24,57.94],[-2237.93,121.4,57]),([10,20,30],[10,20,40])]:
 u.mem_write(TASK,bytes(0x1000));u.mem_write(PED,bytes(0x1000));u.mem_write(PARTNER,bytes(0x1000));u.mem_write(TASK,struct.pack('<Q',VT));u.mem_write(TASK+0x48,struct.pack('<Q',PARTNER));u.mem_write(TASK+0x50,struct.pack('<f',.5));u.mem_write(PED+8,struct.pack('<fff',*a));u.mem_write(PARTNER+8,struct.pack('<fff',*b));run(0x10042012c)
 rows.append({'kind':'points','input':{'a':a,'b':b},'native':{'a':list(struct.unpack('<fff',u.mem_read(TASK+0x54,12))),'b':list(struct.unpack('<fff',u.mem_read(TASK+0x60,12)))}})
for point in [[0,0,0],[-2238.95,120.24,57.94],[12.7,23.6,30]]:
 for directions in range(4):
  for lead in [False,True]:
   events=[];objects={};allocation=ALLOC;u.mem_write(TASK,bytes(0x1000));u.mem_write(TASK+0x48,struct.pack('<Q',PARTNER));u.mem_write(TASK+0x54,struct.pack('<fff',*point));u.mem_write(TASK+0x6c,bytes([int(lead),6,0,directions]));run(0x100421468)
   rows.append({'kind':'sequence','input':{'point':point,'directions':directions,'lead':lead},'native':events})
print(json.dumps({'executableSha256':hashlib.sha256(f).hexdigest(),'functions':['0x10042012c','0x100421468'],'scope':'Chat approach helper and fallback sequence with conversation disabled; type query, allocations, constructors and sequence appends intercepted; complete vector normalization executes','cases':rows},indent=2))
