"""Capture complete CFont::ParseToken calls for closed numeric tokens.
Unicorn 2.1.4, pinned executable. No calls are intercepted. The captures cover
consumed UTF-16 span and unchanged colour, tag, newline and symbol state.
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


SCRATCH=0x200000000;u.mem_map(SCRATCH,0x40000);STRING=SCRATCH+0x1000;COLOUR=SCRATCH+0x2000;TAG=SCRATCH+0x3000
NEWLINE=0x100872610;SYMBOL=0x100872611

def hook(uc,addr,size,user):
 if not 0x10037c3c4<=addr<0x10037c838:raise RuntimeError('Unexpected native call '+hex(addr))
u.hook_add(UC_HOOK_CODE,hook);rows=[]
for token in [f'~{i}~'for i in range(10)]+['~10~','~123456~','~1number~','~9\u00e9~']:
 for blip in [False,True]:
  content=token+'TAIL';u.mem_write(STRING,content.encode('utf-16le')+bytes(2));u.mem_write(COLOUR,bytes([100,101,102,103]));u.mem_write(TAG,b'Z');u.mem_write(NEWLINE,b'\x00');u.mem_write(SYMBOL,b'\x7f')
  for reg,value in [(UC_ARM64_REG_X0,STRING),(UC_ARM64_REG_X1,COLOUR),(UC_ARM64_REG_W2,int(blip)),(UC_ARM64_REG_X3,TAG),(UC_ARM64_REG_SP,SCRATCH+0x3f000),(UC_ARM64_REG_LR,SCRATCH)]:u.reg_write(reg,value)
  u.emu_start(0x10037c3c4,SCRATCH,count=1000)
  consumed=(u.reg_read(UC_ARM64_REG_X0)-STRING)//2
  rows.append({'input':{'token':token,'blip':blip},'consumedCodeUnits':consumed,'remaining':content[consumed:],'colour':list(u.mem_read(COLOUR,4)),'tag':u.mem_read(TAG,1)[0],'newline':u.mem_read(NEWLINE,1)[0],'symbol':u.mem_read(SYMBOL,1)[0]})
print(json.dumps({'executableSha256':hashlib.sha256(f).hexdigest(),'parseToken':'0x10037c3c4','intercepts':[],'cases':rows},indent=2))
