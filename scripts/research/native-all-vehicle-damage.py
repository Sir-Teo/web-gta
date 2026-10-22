"""Capture SET_ALL_CARS_CAN_BE_DAMAGED and both native vehicle-pool walks.
Unicorn 2.1.4, pinned iOS executable. The handler and complete pool walks execute;
CollectParameters, player coordinates and each selected ExtinguishCarFire call
are intercepted. The fire helper's internal engine/CFire behavior is not captured.
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
SCRATCH=0x200000000;u.mem_map(SCRATCH,0x40000)
POOL=SCRATCH+0x1000;DATA=SCRATCH+0x4000;FLAGS=SCRATCH+0x2000;THREAD=SCRATCH+0x3000;PARAMS=0x10079e00c;STRIDE=0xc68
u.mem_write(0x1007abe68,struct.pack('<Q',POOL))
def hook(uc,addr,size,user):
 if addr==0x1001cc0b8:assert uc.reg_read(UC_ARM64_REG_W1)==1;uc.mem_write(PARAMS,struct.pack('<i',case['argument']))
 elif addr==0x1002561e8:
  assert uc.reg_read(UC_ARM64_REG_W0)==0xffffffff
  for reg,value in zip([UC_ARM64_REG_S0,UC_ARM64_REG_S1,UC_ARM64_REG_S2],case['player']):uc.reg_write(reg,struct.unpack('<I',struct.pack('<f',value))[0])
 elif addr==0x100479e54:extinguished.append((uc.reg_read(UC_ARM64_REG_X0)-DATA)//STRIDE)
 elif addr==0x1001e1558:uc.emu_stop();return
 else:
  if 0x1001e0f7c<=addr<0x1001e0fa4 or 0x1001e1598<=addr<0x1001e15b8 or 0x100276910<=addr<0x100276974 or 0x10027652c<=addr<0x1002765fc:return
  raise RuntimeError('Unhandled native call '+hex(addr))
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
u.hook_add(UC_HOOK_CODE,hook)
rows=[]
scenarios=[
 {'name':'all-families','player':[0,0,0],'positions':[[i*2,0,0]for i in range(6)],'valid':[True]*6},
 {'name':'invalid-slots','player':[0,0,0],'positions':[[i*2,0,0]for i in range(6)],'valid':[True,False,True,False,True,False]},
 {'name':'radius-boundary','player':[0,0,0],'positions':[[0,0,0],[3999.99,0,0],[4000,0,0],[4000.00001,0,0],[0,0,4000],[0,0,3999.99]],'valid':[True]*6},
 {'name':'float-rounded-boundary','player':[10000.001,20000.001,30.001],'positions':[[14000.00001,20000.001,30.001],[13999.99999,20000.001,30.001],[10000.001,20000.001,4030.00001],[10000.001,20000.001,4029.99999]],'valid':[True]*4},
 {'name':'empty','player':[0,0,0],'positions':[],'valid':[]},
]
for scenario in scenarios:
 for argument in [0,1,-1,2]:
  case={**scenario,'argument':argument};n=len(case['positions']);u.mem_write(DATA,bytes(STRIDE*6));u.mem_write(POOL,struct.pack('<QQI',DATA,FLAGS,n));u.mem_write(FLAGS,bytes([i if valid else 0x80|i for i,valid in enumerate(case['valid'])])) if n else None
  before=[]
  for i,point in enumerate(case['positions']):
   flags=0xa5a5a5a5a5a5a5a5^(i<<21);before.append(hex(flags));u.mem_write(DATA+i*STRIDE+0x568,struct.pack('<Q',flags));u.mem_write(DATA+i*STRIDE+8,struct.pack('<3f',*point));u.mem_write(DATA+i*STRIDE+0x734,struct.pack('<II',i,i))
  extinguished=[];u.reg_write(UC_ARM64_REG_X19,THREAD);u.reg_write(UC_ARM64_REG_SP,SCRATCH+0x3f000)
  u.emu_start(0x1001e0f7c,SCRATCH,count=5000)
  rows.append({'input':case,'before':before,'after':[hex(struct.unpack('<Q',u.mem_read(DATA+i*STRIDE+0x568,8))[0])for i in range(n)],'extinguished':extinguished})
print(json.dumps({'executableSha256':hashlib.sha256(f).hexdigest(),'handler':'0x1001e0f7c','toggleFunction':'0x100276910','extinguishSelection':'0x10027652c','cases':rows},indent=2))
