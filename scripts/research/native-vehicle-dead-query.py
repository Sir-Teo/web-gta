"""Capture the original IS_CAR_DEAD handler's complete condition selection.
Requires Unicorn 2.1.4 and pinned executable. Only CollectParameters and the
compare-flag sink are intercepted; native pool lookup/status/drowning reads run.
"""
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
SCRATCH=0x200000000;u.mem_map(SCRATCH,0x40000);VEHICLE=SCRATCH+0x1000;POOL=SCRATCH+0x3000;FLAGS=SCRATCH+0x4000;THREAD=SCRATCH+0x5000;PARAMS=0x10079e00c
u.mem_write(0x1007abe68,struct.pack('<Q',POOL));u.mem_write(POOL,struct.pack('<QQI',VEHICLE,FLAGS,1));u.mem_write(FLAGS,b'\x07')
def hook(uc,addr,size,user):
 global answer
 if addr==0x1001cc0b8:assert uc.reg_read(UC_ARM64_REG_W1)==1;uc.mem_write(PARAMS,struct.pack('<i',active_case['handle']))
 elif addr==0x1001dc5ec:answer=bool(uc.reg_read(UC_ARM64_REG_W1));uc.emu_stop();return
 else:
  if 0x1001d0f48<=addr<0x1001d0fbc or 0x1001d1558<=addr<0x1001d1578 or 0x1001d1070<=addr<0x1001d1078 or 0x1001d11ac<=addr<0x1001d11b4:return
  raise RuntimeError('Unhandled native call '+hex(addr))
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
u.hook_add(UC_HOOK_CODE,hook);rows=[]
def capture(case):
 global answer,active_case
 active_case=case
 u.mem_write(VEHICLE,bytes(0x1000));u.mem_write(VEHICLE+0x5a,bytes([case['status']]));u.mem_write(VEHICLE+0x568,struct.pack('<I',1<<30 if case['drowning']else 0));u.mem_write(VEHICLE+0x634,struct.pack('<f',case['health']));u.mem_write(VEHICLE+0x666,struct.pack('<H',case['timer']));u.reg_write(UC_ARM64_REG_X19,THREAD);u.reg_write(UC_ARM64_REG_SP,SCRATCH+0x3f000);answer=None
 u.emu_start(0x1001d0f48,SCRATCH,count=300);assert answer is not None;rows.append({'input':case,'dead':answer})
for status in [2,10,18,42]:
 for health in [0,300,1000]:
  for timer in [0,1234,65535]:
   for drowning in [False,True]:capture({'handle':7,'status':status,'health':health,'timer':timer,'drowning':drowning})
for handle in [-1,0,8]:capture({'handle':handle,'status':18,'health':1000,'timer':0,'drowning':False})
print(json.dumps({'executableSha256':hashlib.sha256(f).hexdigest(),'handler':'0x1001d0f48','cases':rows},indent=2))
