"""Capture TASK_SHOOT_AT_COORD controller selection and constructor arguments.
The handler executes; task processing is outside this capture.
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



SCRATCH=0x200000000;u.mem_map(SCRATCH,0x40000);PED=SCRATCH+0x1000;POOL=SCRATCH+0x3000;INFO=SCRATCH+0x4000;TASK=SCRATCH+0x5000;THREAD=SCRATCH+0x6000
u.mem_write(0x1007abe60,struct.pack('<Q',POOL));u.mem_write(POOL,struct.pack('<Q',PED));rows=[];captured={}
def hook(uc,addr,size,user):
 if addr==0x1001cc0b8:
  assert uc.reg_read(UC_ARM64_REG_W1)==5
 elif addr==0x10049db10:
  assert uc.reg_read(UC_ARM64_REG_W1)==1;uc.reg_write(UC_ARM64_REG_X0,INFO)
 elif addr==0x1003a6ccc:
  captured['allocation']=uc.reg_read(UC_ARM64_REG_W0);uc.reg_write(UC_ARM64_REG_X0,TASK)
 elif addr in [0x1003afb08,0x1003b0cfc]:
  assert uc.reg_read(UC_ARM64_REG_X0)==TASK
  captured['controller']='gun' if addr==0x1003afb08 else 'throw'
  captured['target']=uc.reg_read(UC_ARM64_REG_X1)
  captured['point']=list(struct.unpack('<fff',uc.mem_read(uc.reg_read(UC_ARM64_REG_X2),12)))
  if addr==0x1003afb08:
   captured.update(moveTarget=uc.reg_read(UC_ARM64_REG_X3),command=uc.reg_read(UC_ARM64_REG_W4),burst=uc.reg_read(UC_ARM64_REG_W5),duration=uc.reg_read(UC_ARM64_REG_W6))
 elif addr==0x1001ce2ec:
  assert uc.reg_read(UC_ARM64_REG_X0)==THREAD and uc.reg_read(UC_ARM64_REG_X2)==TASK and uc.reg_read(UC_ARM64_REG_W3)==0x668
  uc.emu_stop();return
 elif 0x1001edf98<=addr<=0x1001ee058:return
 else:raise RuntimeError('Unhandled native call '+hex(addr))
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
u.hook_add(UC_HOOK_CODE,hook)
for handle in [-1,7]:
 for thrown in [False,True]:
  for duration in [0,3000,-1,2147483647]:
   for point in [[-2237.220,170.550,58.450],[0,0,0]]:
    u.mem_write(PED,bytes(0x1000));u.mem_write(PED+0x730,struct.pack('<I',16 if thrown else 38));u.mem_write(INFO+0x19,bytes([int(thrown)]));u.mem_write(0x10079e00c,struct.pack('<ifffi',handle,*point,duration));captured={}
    for reg,value in [(UC_ARM64_REG_X19,THREAD),(UC_ARM64_REG_SP,SCRATCH+0x3f000)]:u.reg_write(reg,value)
    u.emu_start(0x1001edf98,SCRATCH,count=1000)
    rows.append({'input':{'handle':handle,'thrown':thrown,'duration':duration,'point':point},'native':captured})
print(json.dumps({'executableSha256':hashlib.sha256(f).hexdigest(),'handler':'0x1001edf98','intercepts':['CollectParameters','GetWeaponInfo','operator new','controller constructors','GiveScriptTask'],'cases':rows},indent=2))
