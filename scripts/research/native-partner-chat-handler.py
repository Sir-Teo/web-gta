"""Capture TASK_CHAT_WITH_CHAR and its complete PartnerChat constructor stores."""
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



SCRATCH=0x200000000;u.mem_map(SCRATCH,0x40000);PED=SCRATCH+0x1000;POOL=SCRATCH+0x3000;FLAGS=SCRATCH+0x4000;TASK=SCRATCH+0x5000;THREAD=SCRATCH+0x6000
u.mem_write(0x1007abe60,struct.pack('<Q',POOL));u.mem_write(POOL,struct.pack('<QQI',PED,FLAGS,1));u.mem_write(FLAGS,b'\x07');rows=[];allocation=0
def hook(uc,addr,size,user):
 global allocation
 if addr==0x1001cc0b8:assert uc.reg_read(UC_ARM64_REG_W1)==4
 elif addr==0x1003a6ccc:allocation=uc.reg_read(UC_ARM64_REG_W0);uc.reg_write(UC_ARM64_REG_X0,TASK)
 elif addr in [0x1003a6dbc,0x100259730]:pass
 elif addr==0x1004ed940:
  source=uc.reg_read(UC_ARM64_REG_X1);raw=bytes(uc.mem_read(source,32)).split(b'\x00')[0]+b'\x00';assert len(raw)<=32;uc.mem_write(uc.reg_read(UC_ARM64_REG_X0),raw)
 elif addr==0x1001ce2ec:
  assert uc.reg_read(UC_ARM64_REG_X0)==THREAD and uc.reg_read(UC_ARM64_REG_X2)==TASK and uc.reg_read(UC_ARM64_REG_W3)==0x677;uc.emu_stop();return
 elif 0x1001ee6cc<=addr<0x1001ee728 or 0x1001ef8c0<=addr<0x1001ef928 or 0x1004211d8<=addr<0x1004212f0:return
 else:raise RuntimeError('Unhandled call '+hex(addr))
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
u.hook_add(UC_HOOK_CODE,hook)
for handle in [-1,7]:
 for lead in [-1,0,1]:
  for unknown in [-1,0,1]:
   u.mem_write(TASK,bytes(0x1000));u.mem_write(0x10079e00c,struct.pack('<iiii',handle,7,lead,unknown))
   for reg,value in [(UC_ARM64_REG_X19,THREAD),(UC_ARM64_REG_SP,SCRATCH+0x3f000)]:u.reg_write(reg,value)
   u.emu_start(0x1001ee6cc,SCRATCH,count=2000)
   rows.append({'input':{'handle':handle,'lead':lead,'unknown':unknown},'native':{'allocation':allocation,'command':bytes(u.mem_read(TASK+0x20,32)).split(b'\x00')[0].decode(),'taskId':struct.unpack('<I',u.mem_read(TASK+0x40,4))[0],'partner':struct.unpack('<Q',u.mem_read(TASK+0x48,8))[0]==PED,'distanceMultiplier':struct.unpack('<f',u.mem_read(TASK+0x50,4))[0],'lead':bool(u.mem_read(TASK+0x6c,1)[0]),'phase':u.mem_read(TASK+0x6d,1)[0],'first':struct.unpack('<b',u.mem_read(TASK+0x6e,1))[0],'directions':u.mem_read(TASK+0x6f,1)[0],'conversation':bool(u.mem_read(TASK+0x86,1)[0]),'fallback':bool(u.mem_read(TASK+0x87,1)[0])}})
print(json.dumps({'executableSha256':hashlib.sha256(f).hexdigest(),'handler':'0x1001ee6cc','constructor':'0x1004211d8','intercepts':['CollectParameters','operator new','Task base constructor','reference registration','strcpy','GiveScriptTask'],'cases':rows},indent=2))
