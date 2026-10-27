"""Capture the actual native first-person ground lift and IsUpsideDown.

Selected Process_1stPerson prefix optionally executes its reset-statistics
branch with a declared present vehicle RenderWare object. Camera mode entry,
call cadence, pause scheduling and full PC owner are outside this capture.
"""
import argparse,hashlib,itertools,json,math,struct
from pathlib import Path
from unicorn import Uc,UC_ARCH_ARM64,UC_MODE_ARM,UC_HOOK_CODE
from unicorn.arm64_const import *
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--binary',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--profiles',type=Path)
args=p.parse_args();b=args.binary.read_bytes();digest=hashlib.sha256(b).hexdigest()
if len(b)!=14226544 or digest!='9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78':raise ValueError('Not the pinned iOS binary')
n=struct.unpack_from('>I',b,4)[0];off=next(struct.unpack_from('>I',b,8+i*20+8)[0] for i in range(n) if struct.unpack_from('>I',b,8+i*20)[0]==0x100000c);at=off+32;segments=[]
for _ in range(struct.unpack_from('<I',b,off+16)[0]):
 cmd,size=struct.unpack_from('<II',b,at)
 if cmd==0x19:
  vm,vmsz,fo,fsz=struct.unpack_from('<QQQQ',b,at+24);segments.append((vm,fo,fsz))
 at+=size
def data(address,size):
 vm,fo,fsz=next(s for s in segments if s[0]<=address and address+size<=s[0]+s[2]);return b[off+fo+address-vm:off+fo+address-vm+size]

uc=Uc(UC_ARCH_ARM64,UC_MODE_ARM)
for page in [0x100217000,0x100479000,0x10058f000,0x100592000,0x100593000]:
 uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
for page in [0x100932000,0x1007a3000]:uc.mem_map(page,0x1000)
uc.mem_map(0x20000000,0x10000)
camera,vehicle,matrix,stack=0x20000000,0x20001000,0x20002000,0x20008000
stateAddress=0x1009326d8
def capture(i):
 uc.mem_write(0x20000000,bytes(0x10000));uc.mem_write(vehicle+0x18,struct.pack('<Q',matrix));uc.mem_write(matrix+0x28,struct.pack('<f',i['upZ']));uc.mem_write(camera+0x17c,struct.pack('<f',i['sourceZ']));uc.mem_write(stateAddress,struct.pack('<f',i['previous']))
 uc.mem_write(camera+0x1f8,struct.pack('<Q',vehicle));uc.mem_write(vehicle+0x20,struct.pack('<Q',1));uc.mem_write(vehicle+0x5a,bytes([2]));uc.mem_write(camera+0xa,bytes([int(i.get('reset',False))]))
 uc.reg_write(UC_ARM64_REG_X19,camera);uc.reg_write(UC_ARM64_REG_SP,stack)
 if i.get('prefix',False):
  end=0x100217750
  uc.reg_write(UC_ARM64_REG_X0,camera);uc.emu_start(0x10021769c,end,count=100)
  if uc.reg_read(UC_ARM64_REG_PC)!=end:raise RuntimeError('Reset prefix did not finish')
  uc.reg_write(UC_ARM64_REG_SP,stack)
 uc.reg_write(UC_ARM64_REG_X0,vehicle);uc.emu_start(0x100217a90,0x100217af0,count=500)
 if uc.reg_read(UC_ARM64_REG_PC)!=0x100217af0:raise RuntimeError('Ground guard did not finish')
 return {'input':i,'state':struct.unpack('<f',uc.mem_read(stateAddress,4))[0],'sourceZ':struct.unpack('<f',uc.mem_read(camera+0x17c,4))[0]}
profiles=[{'previous':old,'upZ':up,'sourceZ':z} for old,up,z in itertools.product([-.1,0,.03,.47,.49,.5,.51],[-1,-.90000004,-.9,-.8999999,0,1],[-1000,0,13.3,10000])]
profiles += [{'previous':old,'upZ':up,'sourceZ':13.3,'prefix':True,'reset':reset} for old,up,reset in itertools.product([-.1,.49,.51],[-1,1],[False,True])]
fixed=len(profiles)
if args.profiles:
 supplied=json.loads(args.profiles.read_text());supplied=supplied.get('rows',[]) if isinstance(supplied,dict) else supplied
 profiles += [row['groundInput'] for row in supplied if 'groundInput' in row and row.get('active',True) and not row.get('paused',False)]
cases=[capture(i) for i in profiles]
args.output.write_text(json.dumps({'source':__doc__,'sha256':digest,'entries':{'guard':'0x100217a90..0x100217af0','upsideDown':'0x100479678','resetPrefix':'0x10021769c..0x100217750'},'fixedCases':fixed,'cases':cases},indent=2)+'\n');print(json.dumps({'fixed':fixed,'cases':len(cases)}))
