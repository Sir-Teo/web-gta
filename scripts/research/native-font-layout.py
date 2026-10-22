"""Capture ASCII layout spans from the pinned, user-supplied arm64 iOS executable.
Usage: python3 scripts/research/native-font-layout.py /path/to/executable > captures.jsonl
Requires unicorn==2.1.4. No executable bytes are written to the output or repository.
Width and render calls are intercepted; this does not emulate complete CFont rendering.
"""
import hashlib,json,struct,sys
from pathlib import Path
from types import SimpleNamespace
f=Path(sys.argv[1]).read_bytes()
assert hashlib.sha256(f).hexdigest()=='9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78', 'Unexpected executable hash'
slice_offset=next(struct.unpack_from('>I',f,8+i*20+8)[0] for i in range(struct.unpack_from('>I',f,4)[0]) if struct.unpack_from('>I',f,8+i*20)[0]==0x0100000c)
n=SimpleNamespace(f=f,slice=slice_offset)
from unicorn import Uc,UC_ARCH_ARM64,UC_MODE_ARM,UC_HOOK_CODE
from unicorn.arm64_const import *
F=0x100872614;SCRATCH=0x200000000
u=Uc(UC_ARCH_ARM64,UC_MODE_ARM);at=n.slice+32
for _ in range(struct.unpack_from('<I',n.f,n.slice+16)[0]):
 cmd,size=struct.unpack_from('<II',n.f,at)
 if cmd==0x19:
  vm,vm_size,off,length=struct.unpack_from('<QQQQ',n.f,at+24)
  if vm:
   u.mem_map(vm,(vm_size+4095)&~4095)
   u.mem_write(vm,n.f[n.slice+off:n.slice+off+length])
 at+=size
u.mem_map(SCRATCH,0x40000)
u.mem_write(0x1005ac870,struct.pack('<Q',SCRATCH+0x1000))
def scalar(r):return struct.unpack('<f',struct.pack('<I',u.reg_read(r)))[0]
def set_float(r,v):u.reg_write(r,struct.unpack('<I',struct.pack('<f',v))[0])
def text(p,end=None):
 out=''
 while (end is None or p<end) and len(out)<400:
  c=struct.unpack('<H',u.mem_read(p,2))[0]
  if c==0:break
  out+=chr(c);p+=2
 return out
font_bytes=(Path(__file__).resolve().parents[2]/'public/play/world/files/data/fonts.dat').read_bytes()
assert hashlib.sha256(font_bytes).hexdigest()=='0b6ecb4493b0261eece4b025e31aa7b55ae68ca8529c4f7064b5b3b7297c913c', 'Unexpected PC font metrics'
lines=[s.split('#')[0].strip() for s in font_bytes.decode('latin1').splitlines()];lines=[s for s in lines if s]
prop=lines.index('[PROP]');widths=[int(v) for row in lines[prop+1:prop+27] for v in row.split()]
assert len(widths)==208
rows=[]
def hook(uc,addr,size,user):
 if addr==SCRATCH:uc.emu_stop();return
 if addr==0x10037d8f4:
  word=text(uc.reg_read(UC_ARM64_REG_X0)).split(' ',1)[0]
  set_float(UC_ARM64_REG_S0,sum(widths[ord(c)-32] for c in word))
 elif addr==0x10037b358:set_float(UC_ARM64_REG_S0,widths[uc.reg_read(UC_ARM64_REG_W0)])
 elif addr==0x10037c930:
  rows.append({'text':text(uc.reg_read(UC_ARM64_REG_X0),uc.reg_read(UC_ARM64_REG_X1)),'x':scalar(UC_ARM64_REG_S0),'y':scalar(UC_ARM64_REG_S1),'extra':scalar(UC_ARM64_REG_S2)})
 else:
  if not (0x10037d320<=addr<0x10037d8f4 or 0x10037dce4<=addr<0x10037de50):raise RuntimeError('Unhandled '+hex(addr))
  return
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
u.hook_add(UC_HOOK_CODE,hook)
cases=[('A A A',False,False,False,185),('A A A',True,False,False,185),('A A A A',True,False,False,211),('  A A',False,False,False,211),('A  A A',True,False,False,185),('A A A',False,True,False,85),('A A A',True,True,False,85),('A A A',False,False,True,85),('A A A',True,False,True,85),('A  A A',False,True,False,85),('AAAAA',True,False,False,185),('A  A',False,False,False,173),('A ',False,False,False,185),('A  ',False,False,False,185),('   ',False,False,False,185),('  A  ',False,False,False,185),('A A A A',False,False,True,85),('A A A A',True,False,True,85)]
cases.extend(('A A '+prefix+'A',False,False,False,185) for prefix in ['.','!','$',',','/',':','?',chr(92),')'])
for content,justify,centre,right,wrap in cases:
 u.mem_write(F,bytes(0x40));u.mem_write(F,bytes([255])*4);u.mem_write(F+4,struct.pack('<ff',1,1));u.mem_write(F+0x18,bytes([int(justify),int(centre),int(right)]));u.mem_write(F+0x20,struct.pack('<f',255));u.mem_write(F+0x28,struct.pack('<fff',wrap,wrap,0))
 u.mem_write(SCRATCH+0x2000,content.encode('utf-16le')+bytes(2));u.reg_write(UC_ARM64_REG_SP,SCRATCH+0x3f000);u.reg_write(UC_ARM64_REG_LR,SCRATCH);u.reg_write(UC_ARM64_REG_W0,1);u.reg_write(UC_ARM64_REG_X1,SCRATCH+0x2000);set_float(UC_ARM64_REG_S0,100);set_float(UC_ARM64_REG_S1,40);rows=[]
 u.emu_start(0x10037d320,SCRATCH,count=500000)
 print(json.dumps({'input':content,'justify':justify,'centre':centre,'right':right,'wrap':wrap,'rows':rows,'count':u.reg_read(UC_ARM64_REG_W0)}))
