"""Capture APPLY_FORCE_TO_CAR effective mass and complete physical force kernel."""
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



SCRATCH=0x200000000;u.mem_map(SCRATCH,0x80000);VEHICLE=SCRATCH+0x1000;POOL=SCRATCH+0x3000;FLAGS=SCRATCH+0x4000;MATRIX=SCRATCH+0x5000
u.mem_write(0x1007abe68,struct.pack('<Q',POOL));u.mem_write(POOL,struct.pack('<QQI',VEHICLE,FLAGS,1));u.mem_write(FLAGS,b'\x07');rows=[]
effective_mass=0
def hook(uc,addr,size,user):
 global effective_mass
 if addr==0x1001cc0b8:
  assert uc.reg_read(UC_ARM64_REG_W1)==7;uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
 elif addr==0x1001fca10:uc.emu_stop()
 elif addr==0x1001fc9e4:effective_mass=struct.unpack('<f',struct.pack('<I',uc.reg_read(UC_ARM64_REG_S2)))[0]
 elif 0x1001fbc48<=addr<=0x1001fbc94 or 0x1001fc924<=addr<0x1001fca10 or 0x100248404<=addr<0x100248554 or 0x1002cb230<=addr<0x1002cb518:return
 else:raise RuntimeError('Unhandled call '+hex(addr))
u.hook_add(UC_HOOK_CODE,hook)
pairs=[([0,0,.1],[0,0,0]),([0,0,.1],[0,2,0]),([.2,-.3,.1],[1,-2,.5]),([0,0,0],[1,2,3]),([-.02,.005,0],[-3,.4,2])]
inputs=[]
for basis in [[[1,0,0],[0,1,0],[0,0,1]],[[0,1,0],[-1,0,0],[0,0,1]]]:
 for centre in [[0,0,0],[.2,-.3,.4]]:
  for mass,turnMass in [(1000,2000),(100,40)]:
   for force,offset in pairs:inputs.append({'basis':basis,'centre':centre,'mass':mass,'turnMass':turnMass,'force':force,'offset':offset,'flags':0})
for flags in [0x10,0x20,0x40,0x80,0x2000,0x30,0xc0,0x60]:
 for centre in [[0,0,0],[.2,-.3,.4]]:
  for force,offset in pairs:inputs.append({'basis':[[1,0,0],[0,1,0],[0,0,1]],'centre':centre,'mass':1000,'turnMass':2000,'force':force,'offset':offset,'flags':flags})
for case in inputs:
 u.mem_write(VEHICLE,bytes(0x1000));u.mem_write(MATRIX,bytes(0x100));u.mem_write(VEHICLE+0x5a,b'\x02');u.mem_write(VEHICLE+0x18,struct.pack('<Q',MATRIX));u.mem_write(VEHICLE+0x64,struct.pack('<I',case['flags']));u.mem_write(VEHICLE+0x68,struct.pack('<fff',.1,-.2,.3));u.mem_write(VEHICLE+0x74,struct.pack('<fff',.01,-.02,.03));u.mem_write(VEHICLE+0xb0,struct.pack('<ff',case['mass'],case['turnMass']));u.mem_write(VEHICLE+0xc8,struct.pack('<fff',*case['centre']));u.mem_write(0x10079e00c,struct.pack('<iffffff',7,*case['force'],*case['offset']))
 for i,vector in enumerate(case['basis']):u.mem_write(MATRIX+i*16,struct.pack('<fff',*vector))
 u.reg_write(UC_ARM64_REG_SP,SCRATCH+0x7f000);u.emu_start(0x1001fbc48,SCRATCH,count=5000)
 rows.append({'input':{**case,'linear':[.1,-.2,.3],'angular':[.01,-.02,.03]},'native':{'effectiveMass':effective_mass,'linear':list(struct.unpack('<fff',u.mem_read(VEHICLE+0x68,12))),'angular':list(struct.unpack('<fff',u.mem_read(VEHICLE+0x74,12)))}})
print(json.dumps({'executableSha256':hashlib.sha256(f).hexdigest(),'handler':'0x1001fbc48','physicalForce':'0x100248404','intercepts':['CollectParameters'],'scope':'Complete valid-vehicle command and ApplyForce; native COM transform, normalization, cross products, effective mass and velocity stores execute. Stops after ApplyForce returns to handler.','cases':rows},indent=2))
