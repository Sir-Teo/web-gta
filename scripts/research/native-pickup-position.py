"""Capture CPickups::GenerateNewOne compressed position storage in the pinned iOS executable.
Usage: PYTHONPATH=/path/to/unicorn python3 scripts/research/native-pickup-position.py /path/to/executable
Requires unicorn==2.1.4. Only the optional nearby render-object factory is intercepted.
Native allocation, scaled float-to-int conversion, signed-short stores and handle generation execute.
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
SCRATCH=0x200000000;POOL=0x10072f940;u.mem_map(SCRATCH,0x40000)
def hook(uc,addr,size,user):
 if addr==0x1001bfe94:
  # The optional nearby render object is immaterial to the compressed pickup record.
  uc.mem_write(uc.reg_read(UC_ARM64_REG_X1),bytes(8));uc.reg_write(UC_ARM64_REG_X0,0);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR));return
 if not 0x1001c1be4<=addr<0x1001c1f24:raise RuntimeError('Unhandled native call '+hex(addr))
u.hook_add(UC_HOOK_CODE,hook)
cases=[
 ('zero',[0,0,0]),('signed-zero',[-0.,0.,-0.]),
 ('positive-fractions',[.12499,.125,.24999]),('negative-fractions',[-.12499,-.125,-.24999]),
 ('float32-rounds-up',[.1249999999,.2499999999,-.1249999999]),
 ('verdant-disc',[416.9548034667969,2538.812744140625,9.507699966430664]),
 ('grove-interior',[2495.9,-1707.4,1013.3]),('negative-world',[-2035.773,139.434,28.336]),
 ('signed-short-limits',[4095.875,-4096,4096]),('positive-wrap',[4096.125,8191.875,8192]),
 ('negative-wrap',[-4096.125,-8191.875,-8192]),('fractional-wrap',[4095.9999,-4095.9999,8192.2499]),
 ('int32-scaled-boundaries',[268435440,268435456,-268435456]),('int32-overflow',[1e20,-1e20,1e30]),
 ('small-normal',[1e-30,-1e-30,.0001]),('integer-native',[1,-2,1001]),
]
rows=[]
for name,position in cases:
 u.mem_write(POOL,bytes(620*36));u.reg_write(UC_ARM64_REG_SP,SCRATCH+0x3f000);u.reg_write(UC_ARM64_REG_LR,SCRATCH)
 for reg,value in zip([UC_ARM64_REG_S0,UC_ARM64_REG_S1,UC_ARM64_REG_S2],position):u.reg_write(reg,struct.unpack('<I',struct.pack('<f',value))[0])
 for reg,value in [(UC_ARM64_REG_X0,1277),(UC_ARM64_REG_X1,3),(UC_ARM64_REG_X2,0),(UC_ARM64_REG_X3,0),(UC_ARM64_REG_X4,0),(UC_ARM64_REG_X5,0)]:u.reg_write(reg,value)
 u.emu_start(0x1001c1be4,SCRATCH,count=10000)
 compressed=list(struct.unpack('<3h',u.mem_read(POOL+0x14,6)))
 rows.append({'name':name,'input':position,'compressed':compressed,'position':[n/8 for n in compressed],'handle':u.reg_read(UC_ARM64_REG_W0)})
print(json.dumps({'executableSha256':hashlib.sha256(f).hexdigest(),'function':'0x1001c1be4','cases':rows},indent=2))
