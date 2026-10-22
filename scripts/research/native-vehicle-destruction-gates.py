"""Capture vehicle BlowUpCar entry gates and health/timer stores.
Unicorn 2.1.4, pinned executable. Disabled destruction executes through its full
native return. Enabled entries stop at their body; separate two-instruction
fragments capture the zero health/timer stores. No effects/destruction internals
are claimed. Each entry is the +0x150 virtual on its recorded vehicle vtable.
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
SCRATCH=0x200000000;u.mem_map(SCRATCH,0x40000);VEHICLE=SCRATCH+0x1000
functions=[{'name':'bike','vtable':0x1005c0120,'entry':0x1004566d4,'body':0x100456708,'stores':0x100456744,'register':UC_ARM64_REG_X20},
 {'name':'boat','vtable':0x1005c0580,'entry':0x10045c9c4,'body':0x10045c9f0,'stores':0x10045ca2c,'register':UC_ARM64_REG_X19},
 {'name':'helicopter','vtable':0x1005c0868,'entry':0x100467858,'body':0x10046787c,'stores':0x100467a84,'register':UC_ARM64_REG_X19},
 {'name':'plane','vtable':0x1005c0d08,'entry':0x10046d550,'body':0x10046d574,'stores':0x10046d8a0,'register':UC_ARM64_REG_X19}]
def hook(uc,addr,size,user):
 global entered
 if mode=='entry' and addr==fn['body']:entered=True;uc.emu_stop();return
 if not fn['entry']<=addr<fn['entry']+0x600:raise RuntimeError('Unhandled native call '+hex(addr))
u.hook_add(UC_HOOK_CODE,hook);gates=[];stores=[]
for fn in functions:
 assert struct.unpack('<Q',u.mem_read(fn['vtable']+0x150,8))[0]==fn['entry']
 for can in [False,True]:
  for health in [0,300,1000]:
   for status in [2,18]:
    for hide in [False,True]:
     u.mem_write(VEHICLE,bytes(0x1000));u.mem_write(VEHICLE+0x56a,bytes([0x84|(32 if can else 0)]));u.mem_write(VEHICLE+0x5a,bytes([status]));u.mem_write(VEHICLE+0x634,struct.pack('<f',health));u.mem_write(VEHICLE+0x666,struct.pack('<H',1234));before=bytes(u.mem_read(VEHICLE,0x1000));entered=False;mode='entry'
     for reg,value in [(UC_ARM64_REG_X0,VEHICLE),(UC_ARM64_REG_X1,SCRATCH+0x3000),(UC_ARM64_REG_X2,int(hide)),(UC_ARM64_REG_SP,SCRATCH+0x3f000),(UC_ARM64_REG_LR,SCRATCH)]:u.reg_write(reg,value)
     u.emu_start(fn['entry'],SCRATCH,count=100)
     gates.append({'vehicle':fn['name'],'input':{'canBeDamaged':can,'health':health,'status':status,'hideExplosion':hide},'entered':entered,'objectUnchanged':bytes(u.mem_read(VEHICLE,0x1000))==before})
 for health in [0,300,1000]:
  for timer in [0,1000,65535]:
   mode='stores';u.mem_write(VEHICLE,bytes(0x1000));u.mem_write(VEHICLE+0x634,struct.pack('<f',health));u.mem_write(VEHICLE+0x666,struct.pack('<H',timer));u.reg_write(fn['register'],VEHICLE);u.emu_start(fn['stores'],fn['stores']+8,count=10)
   stores.append({'vehicle':fn['name'],'input':{'health':health,'timer':timer},'health':struct.unpack('<f',u.mem_read(VEHICLE+0x634,4))[0],'timer':struct.unpack('<H',u.mem_read(VEHICLE+0x666,2))[0]})
print(json.dumps({'executableSha256':hashlib.sha256(f).hexdigest(),'functions':[{k:hex(v)if isinstance(v,int)else v for k,v in fn.items()if k!='register'}for fn in functions],'gates':gates,'stores':stores},indent=2))
