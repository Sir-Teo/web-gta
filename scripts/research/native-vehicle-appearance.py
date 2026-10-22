"""Capture CVehicle::GetVehicleAppearance in the pinned iOS executable.
Usage: PYTHONPATH=/path/to/unicorn python3 scripts/research/native-vehicle-appearance.py /path/to/executable
Requires unicorn==2.1.4. The complete native function executes without intercepted calls.
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
SCRATCH=0x200000000;u.mem_map(SCRATCH,0x40000);VEHICLE=SCRATCH+0x1000;HANDLING=SCRATCH+0x2000
u.mem_write(VEHICLE+0x4a8,struct.pack('<Q',HANDLING))
def hook(uc,addr,size,user):
 if not 0x100476ec0<=addr<0x100476f14:raise RuntimeError('Unhandled native call '+hex(addr))
u.hook_add(UC_HOOK_CODE,hook)
rows=[]
for unrelated in [0,0xa0f0c3d5]:
 for selection in range(16):
  flags=(selection<<24)|unrelated;u.mem_write(HANDLING+0xcc,struct.pack('<I',flags));u.reg_write(UC_ARM64_REG_X0,VEHICLE);u.reg_write(UC_ARM64_REG_LR,SCRATCH)
  u.emu_start(0x100476ec0,SCRATCH,count=100)
  rows.append({'flags':flags,'appearance':u.reg_read(UC_ARM64_REG_W0)})
print(json.dumps({'executableSha256':hashlib.sha256(f).hexdigest(),'function':'0x100476ec0','cases':rows},indent=2))
