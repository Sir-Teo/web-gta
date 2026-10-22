"""Capture native blast-creator storage and the full delayed-explosion timer.
Requires Unicorn 2.1.4 and the pinned iOS executable. The InflictDamage fragment
intercepts rand/reference registration; the timer only intercepts its virtual
BlowUpCar call. Timer float arithmetic and creator selection execute natively.
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
VEHICLE=SCRATCH+0x1000;PLAYER=SCRATCH+0x2000;PLAYER_CAR=SCRATCH+0x3000;OTHER=SCRATCH+0x4000;VTABLE=SCRATCH+0x5000;CALLBACK=SCRATCH+0x6000
SOURCES={'none':0,'player':PLAYER,'playerVehicle':PLAYER_CAR,'other':OTHER}
def source_name(address):return next(name for name,value in SOURCES.items()if value==address)
def hook(uc,addr,size,user):
 global blew_up,references
 if addr==0x1004ed718:uc.reg_write(UC_ARM64_REG_W0,random_value)
 elif addr==0x100259730:references+=1
 elif addr==CALLBACK:
  blew_up={'source':source_name(uc.reg_read(UC_ARM64_REG_X1)),'hideExplosion':uc.reg_read(UC_ARM64_REG_W2)};uc.emu_stop();return
 else:
  if 0x1004787c4<=addr<0x10047880c or 0x1004788f8<=addr<0x100478948:return
  raise RuntimeError('Unhandled native call '+hex(addr))
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
u.hook_add(UC_HOOK_CODE,hook)
creation=[]
for source,creator in SOURCES.items():
 for random_value in [0,1,2047,2048,32767]:
  u.mem_write(VEHICLE,bytes(0x1000));u.mem_write(VEHICLE+0x668,struct.pack('<Q',OTHER));references=0
  for reg,value in [(UC_ARM64_REG_X20,VEHICLE),(UC_ARM64_REG_X19,creator),(UC_ARM64_REG_X21,51),(UC_ARM64_REG_SP,SCRATCH+0x3f000)]:u.reg_write(reg,value)
  u.emu_start(0x1004787c4,0x10047880c,count=100)
  creation.append({'source':source,'random':random_value,'timer':struct.unpack('<H',u.mem_read(VEHICLE+0x666,2))[0],'storedSource':source_name(struct.unpack('<Q',u.mem_read(VEHICLE+0x668,8))[0]),'references':references})
u.mem_write(VTABLE+0x150,struct.pack('<Q',CALLBACK));ticks=[]
for source,creator in SOURCES.items():
 for timer,time_step in [(0,1),(16,1),(17,1),(32,1),(8,.5),(16,50/60),(1,.06),(1,.059999999),(1,0),(10,1e9),(10,-1),(65535,.1),(20,1.2)]:
  u.mem_write(VEHICLE,bytes(0x1000));u.mem_write(VEHICLE,struct.pack('<Q',VTABLE));u.mem_write(VEHICLE+0x666,struct.pack('<HQ',timer,creator));u.mem_write(0x1007c44a0,struct.pack('<f',time_step));blew_up=None
  u.reg_write(UC_ARM64_REG_X0,VEHICLE);u.reg_write(UC_ARM64_REG_LR,SCRATCH);u.emu_start(0x1004788f8,SCRATCH,count=100)
  ticks.append({'input':{'timer':timer,'timeStep':time_step,'source':source},'timer':struct.unpack('<H',u.mem_read(VEHICLE+0x666,2))[0],'blowUp':blew_up})
print(json.dumps({'executableSha256':hashlib.sha256(f).hexdigest(),'creationFragment':['0x1004787c4','0x10047880c'],'timerFunction':'0x1004788f8','creation':creation,'ticks':ticks},indent=2))
