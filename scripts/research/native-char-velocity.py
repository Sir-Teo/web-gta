"""Capture GET_CHAR_VELOCITY (083D) in the pinned iOS executable.
Usage: PYTHONPATH=/path/to/unicorn python3 scripts/research/native-char-velocity.py /path/to/executable
Requires unicorn==2.1.4. CollectParameters and StoreParameters are intercepted.
Native handle decoding, ped-pool lookup, float loads and three scale multiplies execute.
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
SCRATCH=0x200000000;PARAMS=0x10079e00c;u.mem_map(SCRATCH,0x40000)
POOL=SCRATCH+0x1000;PEDS=SCRATCH+0x2000;HANDLE=(3<<8)|0x5a
u.mem_write(0x1007abe60,struct.pack('<Q',POOL));u.mem_write(POOL,struct.pack('<Q',PEDS))
output=None
def hook(uc,addr,size,user):
 global output
 if addr==0x1001cc0b8:
  assert uc.reg_read(UC_ARM64_REG_W1)==1;uc.mem_write(PARAMS,struct.pack('<i',HANDLE))
 elif addr==0x1001cc41c:
  assert uc.reg_read(UC_ARM64_REG_W1)==3;output=list(struct.unpack('<3I',uc.mem_read(PARAMS,12)));uc.emu_stop();return
 else:
  if not(0x1001fe0e4<=addr<0x1001fe14c or 0x1001fed40<=addr<0x1001fed48):raise RuntimeError('Unhandled native call '+hex(addr))
  return
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
u.hook_add(UC_HOOK_CODE,hook)
cases=[
 ('rest',[0,0,0]),('signed-zero',[-0.,0.,-0.]),('unit',[1,-1,.5]),
 ('walking',[.04,-.018,.002]),('jump',[.013,.027,.16]),('freefall',[.1,-.2,-.9]),
 ('fractional-third',[1/3,-1/3,2/3]),('fractional-sevenths',[1/7,2/7,-3/7]),
 ('small',[1e-6,-1e-6,3e-7]),('large',[1000.25,-500.5,9999.125]),
 ('tiny-normal',[1e-30,-1e-30,2e-30]),('large-finite',[1e20,-1e20,3e20]),
 ('rounding-low',[.0100000001,-.0100000001,.99999999]),
 ('rounding-high',[.0100000009,-.0100000009,1.0000001]),
 ('native-neighbor',[.3333333432674408,.3333333134651184,-.3333333432674408]),
]
rows=[]
for name,velocity in cases:
 output=None;u.mem_write(PEDS+3*0x9c8+0x68,struct.pack('<3f',*velocity));u.reg_write(UC_ARM64_REG_X19,SCRATCH+0x100);u.reg_write(UC_ARM64_REG_SP,SCRATCH+0x3f000)
 u.emu_start(0x1001fe0e4,SCRATCH,count=1000);assert output is not None
 rows.append({'name':name,'handle':HANDLE,'velocity':velocity,'outputBits':output})
print(json.dumps({'executableSha256':hashlib.sha256(f).hexdigest(),'handler':'0x1001fe0e4','cases':rows},indent=2))
