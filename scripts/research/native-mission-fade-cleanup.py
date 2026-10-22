"""Capture native mission fade ownership and the cleanup fade branch."""
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



SCRATCH=0x200000000;u.mem_map(SCRATCH,0x80000);THREAD=SCRATCH+0x1000;PAD=SCRATCH+0x3000
FLAG=0x10079d221;STATE=0x1007c4758;calls=[];phase='';rows=[]
def sf(reg):return struct.unpack('<f',struct.pack('<I',u.reg_read(reg)))[0]
def hook(uc,addr,size,user):
 if addr==0x100227d54:
  calls.append({'seconds':sf(UC_ARM64_REG_S0),'direction':uc.reg_read(UC_ARM64_REG_W1)});uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
 elif addr==0x100242cac:
  assert uc.reg_read(UC_ARM64_REG_W0)==0;uc.reg_write(UC_ARM64_REG_X0,PAD);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
 elif addr==0x1001cc0b8:
  assert uc.reg_read(UC_ARM64_REG_W1)==2;uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
 elif addr in [0x1001ca130,0x1001d3088]:uc.emu_stop()
 elif 0x1001ca0bc<=addr<0x1001ca130 or 0x1001d2600<=addr<0x1001d2660 or 0x1001d2f18<=addr<0x1001d2f34:return
 else:raise RuntimeError('Unexpected native call '+hex(addr))
u.hook_add(UC_HOOK_CODE,hook)
for mission in [False,True]:
 for direction in [0,1]:
  for flag in [False,True]:
   for milliseconds in [0,500]:
    u.mem_write(FLAG,bytes([flag]));u.mem_write(THREAD,bytes(0x200));u.mem_write(THREAD+0x116,bytes([mission]));u.mem_write(0x10079e00c,struct.pack('<ii',milliseconds,direction));calls.clear()
    u.reg_write(UC_ARM64_REG_X19,THREAD);u.reg_write(UC_ARM64_REG_SP,SCRATCH+0x7f000);u.emu_start(0x1001d2600,SCRATCH,count=1000)
    rows.append({'input':{'mission':mission,'direction':direction,'flag':flag,'milliseconds':milliseconds},'native':{'flag':bool(u.mem_read(FLAG,1)[0]),'fades':list(calls)}})
cleanup=[]
for flag in [False,True]:
 for state in range(5):
  for pad in [0,0xffff]:
   u.mem_write(FLAG,bytes([flag]));u.mem_write(STATE,bytes([state]));u.mem_write(PAD+0x110,struct.pack('<H',pad));calls.clear()
   u.reg_write(UC_ARM64_REG_SP,SCRATCH+0x7f000);u.emu_start(0x1001ca0bc,SCRATCH,count=1000)
   cleanup.append({'input':{'flag':flag,'playerState':state,'padFlags':pad},'native':{'flag':bool(u.mem_read(FLAG,1)[0]),'padFlags':struct.unpack('<H',u.mem_read(PAD+0x110,2))[0],'fades':list(calls)}})
print(json.dumps({'executableSha256':hashlib.sha256(f).hexdigest(),'fadeHandler':'0x1001d2600','cleanupPrefix':'0x1001ca0bc..0x1001ca130','scriptHasFadedOut':'0x10079d221','intercepts':['CollectParameters','CCamera::Fade','CPad::GetPad'],'scope':'Complete DO_FADE flag updates and cleanup fade/flag/pad branch. Remaining cleanup body is outside this capture.','fadeCases':rows,'cleanupCases':cleanup},indent=2))
