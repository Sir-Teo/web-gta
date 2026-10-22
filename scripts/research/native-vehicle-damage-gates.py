"""Capture native vehicle damage gates and last-damage storage.
Requires Unicorn 2.1.4 and the pinned iOS executable. CanVehicleBeDamaged and its
CPhysical proof helper execute completely; only player/vehicle lookup is supplied.
The InflictDamage storage fragment executes through its native health subtraction;
reference registration is intercepted. It does not capture later destruction/events.
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
VEHICLE=SCRATCH+0x1000;PLAYER=SCRATCH+0x2000;PLAYER_CAR=SCRATCH+0x3000;OTHER=SCRATCH+0x4000;OUT=SCRATCH+0x5000
SOURCES={'none':0,'player':PLAYER,'playerVehicle':PLAYER_CAR,'other':OTHER}
def hook(uc,addr,size,user):
 if addr==0x100255e24:uc.reg_write(UC_ARM64_REG_X0,PLAYER)
 elif addr==0x100256130:uc.reg_write(UC_ARM64_REG_X0,PLAYER_CAR)
 elif addr==0x100259730:pass
 elif addr==0x100478574:uc.emu_stop();return
 else:
  if 0x1004780a8<=addr<0x1004781b4 or 0x100252b84<=addr<0x100252c20 or 0x10047853c<=addr<0x100478574:return
  raise RuntimeError('Unhandled native call '+hex(addr))
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
u.hook_add(UC_HOOK_CODE,hook)
proofs={'none':0,'bullet':4,'fire':8,'explosion':128,'collision':16,'melee':32}
rows=[]
def capture(case):
 u.mem_write(VEHICLE,bytes(0x1000));u.mem_write(PLAYER,bytes(0x300));u.mem_write(OUT,b'\x00')
 u.mem_write(VEHICLE+0x56a,bytes([32 if case.get('canBeDamaged',True) else 0]));u.mem_write(VEHICLE+0x66,bytes([proofs[case.get('proof','none')]|(64 if case.get('onlyPlayer',False) else 0)]))
 u.mem_write(VEHICLE+0x5a,bytes([2 if case.get('occupied',False) else 18]));u.mem_write(VEHICLE+0x634,struct.pack('<f',case.get('health',1000)));u.mem_write(PLAYER+0x150,struct.pack('<Q',VEHICLE if case.get('attached',False) else 0))
 for reg,value in [(UC_ARM64_REG_X0,VEHICLE),(UC_ARM64_REG_X1,SOURCES[case.get('source','other')]),(UC_ARM64_REG_X2,case['weapon']),(UC_ARM64_REG_X3,OUT),(UC_ARM64_REG_SP,SCRATCH+0x3f000),(UC_ARM64_REG_LR,SCRATCH)]:u.reg_write(reg,value)
 u.emu_start(0x1004780a8,SCRATCH,count=1000)
 rows.append({'input':case,'allowed':bool(u.reg_read(UC_ARM64_REG_W0)),'flagged':bool(u.mem_read(OUT,1)[0])})
for proof in proofs:
 for weapon in range(61):capture({'proof':proof,'weapon':weapon})
for occupied in [False,True]:
 for source in SOURCES:capture({'weapon':31,'occupied':occupied,'source':source,'onlyPlayer':True})
for weapon in [4,18,22,37,49,51]:
 for health in [249,249.99999,249.999999,250,250.000001,250.00001]:capture({'weapon':weapon,'occupied':True,'health':health})
for source in SOURCES:
 capture({'weapon':31,'source':source,'attached':True})
 capture({'weapon':31,'source':source,'canBeDamaged':False})
storage=[]
for source in SOURCES:
 for old_source in ['none','player','other']:
  u.mem_write(VEHICLE,bytes(0x1000));u.mem_write(VEHICLE+0x634,struct.pack('<f',100));u.mem_write(VEHICLE+0x694,b'\x11');u.mem_write(VEHICLE+0x698,struct.pack('<Q',SOURCES[old_source]))
  for reg,value in [(UC_ARM64_REG_X20,VEHICLE),(UC_ARM64_REG_X19,SOURCES[source]),(UC_ARM64_REG_X21,31),(UC_ARM64_REG_S8,struct.unpack('<I',struct.pack('<f',20))[0]),(UC_ARM64_REG_SP,SCRATCH+0x3f000)]:u.reg_write(reg,value)
  u.emu_start(0x10047853c,0x100478574,count=100)
  last=struct.unpack('<Q',u.mem_read(VEHICLE+0x698,8))[0]
  storage.append({'source':source,'previousSource':old_source,'lastSource':next(name for name,value in SOURCES.items()if value==last),'lastWeapon':u.mem_read(VEHICLE+0x694,1)[0],'health':struct.unpack('<f',u.mem_read(VEHICLE+0x634,4))[0]})
print(json.dumps({'executableSha256':hashlib.sha256(f).hexdigest(),'gate':'0x1004780a8','proofHelper':'0x100252b84','storageFragment':['0x10047853c','0x100478574'],'cases':rows,'storage':storage},indent=2))
