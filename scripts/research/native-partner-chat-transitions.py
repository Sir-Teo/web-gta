"""Capture native partner-chat handshake transitions, not full task execution."""
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



SCRATCH=0x200000000;u.mem_map(SCRATCH,0x80000);TASK=SCRATCH+0x1000;PED=SCRATCH+0x3000;PARTNER=SCRATCH+0x5000;OTHER=SCRATCH+0x7000;SUB=SCRATCH+0x9000;VT=SCRATCH+0xa000;TYPE=SCRATCH+0x100;ALLOC=SCRATCH+0x10000
u.mem_write(VT+0x28,struct.pack('<Q',TYPE));u.mem_write(VT+0x78,struct.pack('<Q',0x100421468));u.mem_write(SUB,struct.pack('<Q',VT));rows=[];events=[];subtype=203;exists=True;reciprocal=True;allocation=ALLOC
rd=lambda off:struct.unpack('<b',u.mem_read(TASK+off,1))[0]
def hook(uc,addr,size,user):
 global allocation
 if addr==TYPE:uc.reg_write(UC_ARM64_REG_W0,1204 if uc.reg_read(UC_ARM64_REG_X0)==TASK else subtype)
 elif addr==0x10041eb3c:uc.reg_write(UC_ARM64_REG_X0,OTHER if exists else 0)
 elif addr==0x1003a6ccc:
  allocation+=0x100;uc.mem_write(allocation,bytes(0x100));uc.reg_write(UC_ARM64_REG_X0,allocation)
 elif addr==0x1003be260:events.append({'kind':'stand','ms':uc.reg_read(UC_ARM64_REG_W1)})
 elif addr==0x1004035e4:
  events.append({'kind':'goto','point':list(struct.unpack('<fff',uc.mem_read(uc.reg_read(UC_ARM64_REG_X2),12)))})
 elif addr==0x10040c09c:events.append({'kind':'turn'})
 elif addr==0x100421468:events.append({'kind':'sequence'});uc.reg_write(UC_ARM64_REG_X0,ALLOC+0xf000)
 elif 0x10041f988<=addr<0x10042012c or 0x10042012c<=addr<0x100420308 or 0x1002cb4c4<=addr<0x1002cb518:return
 else:raise RuntimeError('Unhandled call '+hex(addr))
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
u.hook_add(UC_HOOK_CODE,hook)
def setup(phase,otherPhase,lead):
 global allocation,events
 allocation=ALLOC;events=[];u.mem_write(TASK,bytes(0x1000));u.mem_write(OTHER,bytes(0x1000));u.mem_write(PED,bytes(0x1000));u.mem_write(PARTNER,bytes(0x1000));u.mem_write(TASK,struct.pack('<Q',VT));u.mem_write(TASK+0x10,struct.pack('<Q',SUB));u.mem_write(TASK+0x40,struct.pack('<I',1204));u.mem_write(TASK+0x48,struct.pack('<Q',PARTNER));u.mem_write(TASK+0x50,struct.pack('<f',.5));u.mem_write(TASK+0x54,struct.pack('<fff',10,20,30));u.mem_write(TASK+0x60,struct.pack('<fff',12,24,30));u.mem_write(TASK+0x6c,bytes([int(lead),phase,255,4]));u.mem_write(TASK+0x82,b'\x01');u.mem_write(OTHER+0x48,struct.pack('<Q',PED if reciprocal else PARTNER));u.mem_write(OTHER+0x6d,bytes([otherPhase,255]));u.mem_write(PED+8,struct.pack('<fff',10,20,30));u.mem_write(PARTNER+8,struct.pack('<fff',16,28,30));u.mem_write(PARTNER+0x538,struct.pack('<Q',SCRATCH+0xc000));u.mem_write(PED+0x538,struct.pack('<Q',SCRATCH+0xd000))
 for reg,value in [(UC_ARM64_REG_X0,TASK),(UC_ARM64_REG_X1,PED),(UC_ARM64_REG_SP,SCRATCH+0x7f000),(UC_ARM64_REG_LR,SCRATCH)]:u.reg_write(reg,value)
for phase in range(1,7):
 for otherPhase in range(1,7):
  for lead in [False,True]:
   for subtype in ([903,920,203] if phase==3 else [203]):
    exists=True;reciprocal=True;setup(phase,otherPhase,lead)
    try:u.emu_start(0x10041f988,SCRATCH,count=3000)
    except Exception:
     print(phase,otherPhase,lead,subtype,hex(u.reg_read(UC_ARM64_REG_PC)),file=sys.stderr);raise
    rows.append({'input':{'phase':phase,'otherPhase':otherPhase,'lead':lead,'subtype':subtype,'exists':True,'reciprocal':True},'native':{'phase':rd(0x6d),'first':rd(0x6e),'directions':rd(0x6f),'otherFirst':struct.unpack('<b',u.mem_read(OTHER+0x6e,1))[0],'point':list(struct.unpack('<fff',u.mem_read(TASK+0x54,12))),'otherPoint':list(struct.unpack('<fff',u.mem_read(OTHER+0x54,12))),'actions':events,'ended':u.reg_read(UC_ARM64_REG_X0)==0}})
for phase in range(1,7):
 for exists,reciprocal in [(False,True),(True,False)]:
  subtype=203;setup(phase,1,True);u.emu_start(0x10041f988,SCRATCH,count=3000);rows.append({'input':{'phase':phase,'otherPhase':1,'lead':True,'subtype':subtype,'exists':exists,'reciprocal':reciprocal},'native':{'ended':u.reg_read(UC_ARM64_REG_X0)==0,'actions':events}})
print(json.dumps({'executableSha256':hashlib.sha256(f).hexdigest(),'function':'0x10041f988','scope':'Partner NextSubTask, makePedAlwaysFacePartner=false, animations ready, four direction updates; task lookup, constructors and sequence creation intercepted','cases':rows},indent=2))
