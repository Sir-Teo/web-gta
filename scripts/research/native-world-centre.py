"""Capture native world-centre selection with camera generation disabled.
Unicorn 2.1.4, pinned executable. Both complete centre helpers execute with
no intercepted calls, covering remote/occupied/ped priority and both pose forms.
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



SCRATCH=0x200000000;u.mem_map(SCRATCH,0x40000);PED=SCRATCH+0x1000;OCCUPIED=SCRATCH+0x3000;REMOTE=SCRATCH+0x5000;PLAYERS=0x1007c4640
positions={'ped':[10,20,30],'occupied':[100,200,300],'remote':[1000,2000,3000]}
def hook(uc,addr,size,user):
 if not(0x10025680c<=addr<0x100256988):raise RuntimeError('Unexpected native call '+hex(addr))
u.hook_add(UC_HOOK_CODE,hook);rows=[]
for fn in [0x10025680c,0x1002568c0]:
 for remote in [False,True]:
  for occupied in [False,True]:
   for matrix in [False,True]:
    pointers={}
    for index,(name,entity)in enumerate([('ped',PED),('occupied',OCCUPIED),('remote',REMOTE)]):
     u.mem_write(entity,bytes(0x1000));u.mem_write(entity+8,struct.pack('<fff',*positions[name]));mat=SCRATCH+0x10000+index*0x1000;u.mem_write(mat+0x30,struct.pack('<fff',*[p+d for p,d in zip(positions[name],[.25,.5,.75])]))
     u.mem_write(entity+0x18,struct.pack('<Q',mat if matrix else 0));pointers[mat+0x30 if matrix else entity+8]=name
    u.mem_write(0x10071d755,b'\x00');u.mem_write(0x1007c49f0,b'\x00');u.mem_write(PLAYERS,bytes(0x1d8));u.mem_write(PLAYERS,struct.pack('<Q',PED));u.mem_write(PLAYERS+0xe0,struct.pack('<Q',REMOTE if remote else 0));u.mem_write(PED+0x708,struct.pack('<Q',OCCUPIED if occupied else 0));u.mem_write(PED+0x585,bytes([int(occupied)]))
    for reg,value in [(UC_ARM64_REG_W0,0),(UC_ARM64_REG_SP,SCRATCH+0x3f000),(UC_ARM64_REG_LR,SCRATCH)]:u.reg_write(reg,value)
    u.emu_start(fn,SCRATCH,count=1000);pointer=u.reg_read(UC_ARM64_REG_X0);assert pointer in pointers
    rows.append({'function':hex(fn),'input':{'remote':remote,'occupied':occupied,'matrix':matrix},'source':pointers[pointer],'position':list(struct.unpack('<fff',u.mem_read(pointer,12)))})
print(json.dumps({'executableSha256':hashlib.sha256(f).hexdigest(),'cameraGeneration':False,'positions':positions,'intercepts':[],'cases':rows},indent=2))
