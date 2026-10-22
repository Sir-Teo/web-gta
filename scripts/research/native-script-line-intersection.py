"""Capture opcode 05B0's native arithmetic, comparison and stored output.
Usage: PYTHONPATH=/path/to/unicorn python3 scripts/research/native-script-line-intersection.py /path/to/executable
Requires unicorn==2.1.4. Parameter collection/storage and UpdateCompareFlag are intercepted;
the complete slope, bounds/tolerance and sentinel decisions execute in the pinned arm64 handler.
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
SCRATCH=0x200000000;PARAMS=0x10079e00c;u.mem_map(SCRATCH,0x40000);compare=None;output=None
def hook(uc,addr,size,user):
 global compare,output
 if addr==0x1001cc0b8:
  assert uc.reg_read(UC_ARM64_REG_W1)==8;uc.mem_write(PARAMS,struct.pack('<8f',*case['segments']))
 elif addr==0x1001dc5ec:compare=bool(uc.reg_read(UC_ARM64_REG_W1))
 elif addr==0x1001cc41c:
  assert uc.reg_read(UC_ARM64_REG_W1)==2;output=list(struct.unpack('<2f',uc.mem_read(PARAMS,8)));uc.emu_stop();return
 else:
  if not (0x1001e61d0<=addr<0x1001e635c or 0x1001e7e30<=addr<0x1001e7e40 or 0x1001e7bd8<=addr<0x1001e7be0):raise RuntimeError('Unhandled native call '+hex(addr))
  return
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
u.hook_add(UC_HOOK_CODE,hook)
cases=[
 {'name':'diagonals','segments':[0,0,10,10,0,10,10,0]},
 {'name':'horizontal-vertical','segments':[0,2,10,2,5,0,5,4]},
 {'name':'vertical-horizontal','segments':[5,0,5,4,0,2,10,2]},
 {'name':'parallel','segments':[0,0,10,0,0,5,10,5]},
 {'name':'coincident','segments':[0,0,10,10,2,2,4,4]},
 {'name':'outside-first-segment','segments':[0,0,1,1,2,0,2,4]},
 {'name':'outside-second-segment','segments':[0,0,4,4,0,2,1,2]},
 {'name':'shared-endpoint','segments':[0,0,1,1,1,1,2,0]},
 {'name':'first-point','segments':[1,1,1,1,0,0,2,2]},
 {'name':'second-point','segments':[0,0,2,2,1,1,1,1]},
 {'name':'both-points','segments':[1,1,1,1,1,1,1,1]},
 {'name':'parallel-vertical','segments':[0,0,0,10,1,0,1,10]},
 {'name':'collinear-vertical-different-lengths','segments':[0,0,0,10,0,0,0,20]},
 {'name':'near-parallel','segments':[0,0,10,10,0,.00001,10,10.00002]},
 {'name':'pool-back-line','segments':[510.307,-79.490,510.1015625,-84.485939,509.6115625,-83.8759375,510.5915625,-83.8759375]},
]
for x in [1,1.005,1.01,1.01001,1.0101,-.005,-.01,-.01001]:cases.append({'name':'endpoint-tolerance-'+str(x),'segments':[0,0,1,0,x,-1,x,1]})
for base in list(cases[:8]):
 c={'name':'reversed-'+base['name'],'segments':base['segments'][2:4]+base['segments'][:2]+base['segments'][6:8]+base['segments'][4:6]};cases.append(c)
for case in cases:
 compare=None;output=None;u.reg_write(UC_ARM64_REG_X19,SCRATCH+0x1000);u.reg_write(UC_ARM64_REG_SP,SCRATCH+0x3f000)
 u.emu_start(0x1001e61d0,SCRATCH,count=10000)
 assert compare is not None and output is not None
 print(json.dumps({'input':case,'intersects':compare,'point':output}))
