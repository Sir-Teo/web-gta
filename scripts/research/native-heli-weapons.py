"""Capture native helicopter gun and rocket request helpers."""
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



SCRATCH=0x200000000;u.mem_map(SCRATCH,0x80000)
VEHICLE=SCRATCH+0x1000;TARGET=SCRATCH+0x3000;MATRIX=SCRATCH+0x5000;TARGET_MATRIX=SCRATCH+0x6000
rows=[];launches=[]
def vf(addr):return list(struct.unpack('<fff',u.mem_read(addr,12)))
def sf(reg):return struct.unpack('<f',struct.pack('<I',u.reg_read(reg)))[0]
def hook(uc,addr,size,user):
 if addr==0x100491668:
  launches.append({'creator':uc.reg_read(UC_ARM64_REG_X0)==VEHICLE,'weapon':uc.reg_read(UC_ARM64_REG_W1),'origin':[sf(r)for r in [UC_ARM64_REG_S0,UC_ARM64_REG_S1,UC_ARM64_REG_S2]],'force':sf(UC_ARM64_REG_S3),'direction':vf(uc.reg_read(UC_ARM64_REG_X2)),'target':uc.reg_read(UC_ARM64_REG_X3)})
  uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
 elif 0x1001a0ac0<=addr<0x1001a0c74 or 0x10017fec0<=addr<0x10017ff50 or 0x10019fa50<=addr<0x10019fb60 or 0x1002cb4c4<=addr<0x1002cb518 or 0x1002567a0<=addr<0x1002567e0:return
 else:raise RuntimeError('Unhandled native call '+hex(addr))
u.hook_add(UC_HOOK_CODE,hook)
inputs=[]
for selection in range(8):
 for target in [[0,50,0],[0,-50,0],[6.999,50,0],[7,50,0],[0,50,7],[0,79.999,0],[0,80,0],[0,0,0]]:
  inputs.append({'selection':selection,'position':[0,0,0],'basis':[[1,0,0],[0,1,0],[0,0,1]],'target':target,'now':250,'previous':249})
for now,previous in [(0,0),(249,248),(250,250),(251,250),(500,499),(501,250),(4294967295,4294967250),(0,4294967295),(2000,1999)]:
 for selection in [0,4]:inputs.append({'selection':selection,'position':[10,20,30],'basis':[[1,0,0],[0,1,0],[0,0,1]],'target':[10,70,30],'now':now,'previous':previous})
for basis,target in [([[0,1,0],[-1,0,0],[0,0,1]],[-40,20,30]),([[0,1,0],[-1,0,0],[0,0,1]],[60,20,30]),([[1,0,0],[0,.6,.8],[0,-.8,.6]],[10,50,70]),([[2,0,0],[0,2,0],[0,0,2]],[16,70,30]),([[1,0,0],[0,0,0],[0,0,1]],[10,70,30])]:
 for now in [250,500,750]:inputs.append({'selection':0,'position':[10,20,30],'basis':basis,'target':target,'now':now,'previous':now-1})
for basis in [[[0,-1,0],[1,0,0],[0,0,1]],[[0,1,0],[-1,0,0],[0,0,1]]]:
 for target in [[10,20,30],[60,20,30],[-40,20,30],[10,20,180],[10,20,179.999],[50,50,30]]:
  inputs.append({'selection':0,'position':[10,20,30],'basis':basis,'target':target,'now':250,'previous':249})
for case in inputs:
 u.mem_write(VEHICLE,bytes(0x1000));u.mem_write(TARGET,bytes(0x1000));u.mem_write(MATRIX,bytes(0x100));u.mem_write(TARGET_MATRIX,bytes(0x100));u.mem_write(VEHICLE+0x18,struct.pack('<Q',MATRIX));u.mem_write(TARGET+0x18,struct.pack('<Q',TARGET_MATRIX));u.mem_write(VEHICLE+0x6a3,bytes([case['selection']]));u.mem_write(MATRIX+0x30,struct.pack('<fff',*case['position']));u.mem_write(TARGET_MATRIX+0x30,struct.pack('<fff',*case['target']));u.mem_write(0x1007c4478,struct.pack('<I',case['now']));u.mem_write(0x1007c4484,struct.pack('<I',case['previous']))
 for j,v in enumerate(case['basis']):u.mem_write(MATRIX+j*16,struct.pack('<fff',*v))
 launches.clear()
 for fn in [0x10019fa50,0x1001a0ac0]:
  for reg,value in [(UC_ARM64_REG_X0,VEHICLE),(UC_ARM64_REG_X1,TARGET),(UC_ARM64_REG_SP,SCRATCH+0x7f000),(UC_ARM64_REG_LR,SCRATCH)]:u.reg_write(reg,value)
  u.emu_start(fn,SCRATCH,count=2000)
 rows.append({'input':case,'native':{'guns':bool(struct.unpack('<Q',u.mem_read(VEHICLE+0x568,8))[0]&(1<<36)),'launches':list(launches)}})
selectors=[];PED=SCRATCH+0xa000;RIDE=SCRATCH+0xc000
for in_vehicle in [False,True]:
 for vehicle_pointer in [False,True]:
  u.mem_write(PED,bytes(0x1000));u.mem_write(PED+0x585,bytes([in_vehicle]));u.mem_write(PED+0x708,struct.pack('<Q',RIDE if vehicle_pointer else 0));u.mem_write(0x1007c4640,struct.pack('<Q',PED));u.mem_write(0x1007c49f0,b'\x00');u.reg_write(UC_ARM64_REG_W0,0xffffffff);u.reg_write(UC_ARM64_REG_SP,SCRATCH+0x7f000);u.reg_write(UC_ARM64_REG_LR,SCRATCH);u.emu_start(0x1002567a0,SCRATCH,count=100)
  assert u.reg_read(UC_ARM64_REG_X0)in[PED,RIDE]
  selectors.append({'input':{'inVehicle':in_vehicle,'vehiclePointer':vehicle_pointer},'native':'vehicle'if u.reg_read(UC_ARM64_REG_X0)==RIDE else'ped'})
print(json.dumps({'executableSha256':hashlib.sha256(f).hexdigest(),'guns':'0x10019fa50','rockets':'0x1001a0ac0','pointLineDistance':'0x10017fec0','targetSelector':'0x1002567a0','targetCases':selectors,'intercepts':['CProjectileInfo::AddProjectile'],'scope':'Complete shared gun request and helicopter rocket helper, including native normalization, distance to infinite forward line, clock gates and alternating origin. Weapon helpers use a valid non-null target. Four additional complete FindPlayerEntity selections execute without intercepted calls.','cases':rows},indent=2))
