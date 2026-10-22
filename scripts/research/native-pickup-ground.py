"""Capture ground-sentinel handling in CREATE_PICKUP and CREATE_PICKUP_WITH_AMMO.
Usage: PYTHONPATH=/path/to/unicorn python3 scripts/research/native-pickup-ground.py /path/to/executable
Requires unicorn==2.1.4. Collect/store, output-variable reading, ground query and pickup generation
are intercepted. Native float comparison, offset arithmetic, operand selection and flags execute.
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
def floatreg(reg):return struct.unpack('<f',struct.pack('<I',u.reg_read(reg)))[0]
def setfloat(reg,value):u.reg_write(reg,struct.unpack('<I',struct.pack('<f',value))[0])
def hook(uc,addr,size,user):
 global generated,stored
 if addr==0x1001cc0b8:
  assert uc.reg_read(UC_ARM64_REG_W1)==(6 if ammo else 5)
  values=struct.pack('<iii',case['model'],case['type'],case['ammo']) if ammo else struct.pack('<ii',case['model'],case['type'])
  uc.mem_write(PARAMS,values+struct.pack('<3f',*case['position']))
 elif addr==0x100275120:
  queries.append([floatreg(UC_ARM64_REG_S0),floatreg(UC_ARM64_REG_S1)]);setfloat(UC_ARM64_REG_S0,case['ground'])
 elif addr==0x1001cc264:uc.reg_write(UC_ARM64_REG_W0,0xffffffff)
 elif addr==0x1001c1be4:
  generated={'model':uc.reg_read(UC_ARM64_REG_W0),'type':uc.reg_read(UC_ARM64_REG_W1),'ammo':uc.reg_read(UC_ARM64_REG_W2),'position':[floatreg(r)for r in [UC_ARM64_REG_S0,UC_ARM64_REG_S1,UC_ARM64_REG_S2]]};uc.reg_write(UC_ARM64_REG_W0,65539)
 elif addr==0x1001cc41c:
  assert uc.reg_read(UC_ARM64_REG_W1)==1;stored=struct.unpack('<I',uc.mem_read(PARAMS,4))[0];uc.emu_stop();return
 else:
  if not(0x1001d45c0<=addr<0x1001d465c or 0x1001d4db8<=addr<0x1001d4dc4 or 0x1001d7fa8<=addr<0x1001d804c or 0x1001c22f4<=addr<0x1001c232c):raise RuntimeError('Unhandled native call '+hex(addr))
  return
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
u.hook_add(UC_HOOK_CODE,hook)
points=[('explicit-verdant',9.507699966430664,111),('above-limit',-99.99999,12.25),('rounds-to-limit',-99.999999,12.24999),('exact-limit',-100,12.25),('below-limit',-100.00001,12.25),('low-sentinel',-1000,20),('negative-ground',-100,-20.32),('fractional-ground',-100,1/3),('interior-ground',-100,1001.90001),('explicit-positive',5.4321,-50)]
rows=[]
for ammo in [False,True]:
 for name,z,ground in points:
  case={'name':name,'opcode':811 if ammo else 531,'model':346 if ammo else 1277,'type':15 if ammo else 3,'ammo':60 if ammo else 0,'position':[416.9548034667969,2538.812744140625,z],'ground':ground}
  queries=[];generated=None;stored=None;u.reg_write(UC_ARM64_REG_X19,SCRATCH+0x1000);u.reg_write(UC_ARM64_REG_SP,SCRATCH+0x3f000)
  u.emu_start(0x1001d7fa8 if ammo else 0x1001d45c0,SCRATCH,count=1000);assert generated is not None and stored==65539
  rows.append({'input':case,'groundQueries':queries,'generated':generated})
print(json.dumps({'executableSha256':hashlib.sha256(f).hexdigest(),'handlers':['0x1001d45c0','0x1001d7fa8'],'cases':rows},indent=2))
