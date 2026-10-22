"""Capture DestroyCar ControlSubTask target-health selection.
Requires Unicorn 2.1.4 and pinned executable. Only GetTaskType is intercepted, returning an existing LeaveCar subtask.
The complete target-health selection and native return execute; armed/melee
subtask control and ped/vehicle simulation are outside these captures.
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

SCRATCH=0x200000000;u.mem_map(SCRATCH,0x40000);TASK=SCRATCH+0x1000;PED=SCRATCH+0x2000;VEHICLE=SCRATCH+0x4000;SUBTASK=SCRATCH+0x6000;VTABLE=SCRATCH+0x7000;GET_TYPE=SCRATCH+0x200
assert struct.unpack('<Q',u.mem_read(0x1005b8d78+0x60,8))[0]==0x1003b8d50
queries=0
def hook(uc,addr,size,user):
 global queries
 if addr==GET_TYPE:
  queries+=1;uc.reg_write(UC_ARM64_REG_W0,704);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR));return
 if not 0x1003b8d50<=addr<0x1003b8f80:raise RuntimeError('Unhandled native call '+hex(addr))
u.hook_add(UC_HOOK_CODE,hook);rows=[]
for exists in [False,True]:
 for status in [2,42]:
  for bits in [0,0x80000000,0x3f800000,0xbf800000,0x7f800000,0xff800000,0x7fc00000,1,0x80000001]:
   u.mem_write(TASK,bytes(0x1000));u.mem_write(TASK+0x20,struct.pack('<Q',VEHICLE if exists else 0));u.mem_write(TASK+0x10,struct.pack('<Q',SUBTASK));u.mem_write(SUBTASK,struct.pack('<Q',VTABLE));u.mem_write(VTABLE+0x28,struct.pack('<Q',GET_TYPE));u.mem_write(VEHICLE,bytes(0x1000));u.mem_write(VEHICLE+0x5a,bytes([status]));u.mem_write(VEHICLE+0x634,struct.pack('<I',bits));queries=0
   for reg,value in [(UC_ARM64_REG_X0,TASK),(UC_ARM64_REG_X1,PED),(UC_ARM64_REG_SP,SCRATCH+0x3f000),(UC_ARM64_REG_LR,SCRATCH)]:u.reg_write(reg,value)
   u.emu_start(0x1003b8d50,SCRATCH,count=1000)
   result=u.reg_read(UC_ARM64_REG_X0);assert result in [0,SUBTASK]
   rows.append({'input':{'exists':exists,'status':status,'healthBits':bits},'active':result==SUBTASK,'subtaskQueries':queries})
print(json.dumps({'executableSha256':hashlib.sha256(f).hexdigest(),'control':'0x1003b8d50','subtask':704,'cases':rows},indent=2))
