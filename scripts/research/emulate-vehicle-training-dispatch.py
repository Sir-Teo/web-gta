"""Capture selected vehicle-stat routing and actual vehicle appearance.

Executes the original routing block through its continuation; only the three
training callees are logged stubs. Quad/motorbike/BMX flags are packaged
handling inputs. This is not a capture of complete CPlayerInfo::Process.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
from unicorn import Uc, UC_ARCH_ARM64, UC_MODE_ARM
from unicorn.arm64_const import *

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--binary',required=True,type=Path)
parser.add_argument('--output',required=True,type=Path)
args=parser.parse_args()
b=args.binary.read_bytes()
sha256=hashlib.sha256(b).hexdigest()
if len(b)!=14226544 or sha256!='9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78':
 raise ValueError('The binary is not the pinned iOS reference.')
if struct.unpack_from('>I',b)[0]!=0xcafebabe:raise ValueError('Not a universal Mach-O.')
n=struct.unpack_from('>I',b,4)[0]
off=next(struct.unpack_from('>I',b,8+i*20+8)[0] for i in range(n) if struct.unpack_from('>I',b,8+i*20)[0]==0x100000c)
if struct.unpack_from('<I',b,off)[0]!=0xfeedfacf:raise ValueError('No arm64 Mach-O slice.')
at=off+32
segments=[]
for _ in range(struct.unpack_from('<I',b,off+16)[0]):
 cmd,size=struct.unpack_from('<II',b,at)
 if cmd==0x19:
  vm,vmsz,fo,fsz=struct.unpack_from('<QQQQ',b,at+24)
  segments.append((vm,fo,fsz))
 at+=size
def data(addr,n):
 vm,fo,fsz=next(s for s in segments if s[0]<=addr<s[0]+s[2])
 return b[off+fo+addr-vm:off+fo+addr-vm+n]

from unicorn import UC_HOOK_CODE
uc=Uc(UC_ARCH_ARM64,UC_MODE_ARM)
for page in [0x100254000,0x100255000,0x100265000,0x100476000]:
 uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
uc.mem_map(0x20000000,0x10000)
vehicle,ped,handling,players,index=0x20000000,0x20002000,0x20003000,0x20008000,0x20009000
calls=[]
def hook(uc,addr,size,unused):
 names={0x100265c70:'driving',0x100265e00:'flying',0x100265f94:'motorbike'}
 if addr not in names:return
 calls.append({'name':names[addr],'address':hex(addr),'vehicleArgument':uc.reg_read(UC_ARM64_REG_X0)==vehicle});uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
uc.hook_add(UC_HOOK_CODE,hook)
rows=[]
profiles=[('quad',471,0x281300,0,2),('motorbike',461,0x1002000,9,9),('bmx',481,0x41000000,9,10),('car',400,0,0,0),('train',None,0,6,6)]
handlingBytes=Path('public/play/world/files/vehicles/handling.cfg').read_bytes()
handlingRows={row[0]:row for line in handlingBytes.decode().splitlines() if (row:=line.split()) and row[0] in ['QUADBIKE','BIKE','BMX']}
for name,flags in [('QUADBIKE',0x281300),('BIKE',0x1002000),('BMX',0x41000000)]:
 if int(handlingRows[name][31],16)!=flags:raise ValueError('Packaged model flags changed for '+name)
for name,model,flags,baseType,subType in profiles:
 for velocity in ([(0,0,0),(.1,0,0),(-.1,0,0),(0,.1,0),(0,0,-.1),(1e-24,0,0),(1e-20,0,0),(0,1e-24,0),(1e-23,1e-23,1e-23),(1e-22,1e-22,1e-22)] if name=='motorbike' else [(0,0,0),(.1,0,0)]):
  calls=[];uc.mem_write(vehicle,bytes(0x4000));uc.mem_write(vehicle+0x4a8,struct.pack('<Q',handling));uc.mem_write(handling+0xcc,struct.pack('<I',flags));uc.mem_write(vehicle+0x734,struct.pack('<II',baseType,subType));uc.mem_write(vehicle+0x68,struct.pack('<fff',*velocity));uc.mem_write(ped+0x585,b'\1');uc.mem_write(ped+0x708,struct.pack('<Q',vehicle));uc.mem_write(players,struct.pack('<Q',ped));uc.mem_write(index,b'\0')
  uc.reg_write(UC_ARM64_REG_X22,index);uc.reg_write(UC_ARM64_REG_X23,players);uc.reg_write(UC_ARM64_REG_SP,0x2000e000);uc.emu_start(0x100254df8,0x100254770,count=1000)
  if uc.reg_read(UC_ARM64_REG_PC)!=0x100254770:raise RuntimeError('Dispatch did not reach its original continuation.')
  rows.append({'input':{'name':name,'model':model,'modelFlags':flags,'baseType':baseType,'subType':subType,'velocity':list(struct.unpack('<fff',struct.pack('<fff',*velocity))),'inVehicle':True},'calls':calls.copy()})
args.output.write_text(json.dumps({'source':'Selected CPlayerInfo vehicle-stat routing block and actual GetVehicleAppearance; training callees are logged stubs, valid current vehicle declared','sha256':sha256,'handlingSha256':hashlib.sha256(handlingBytes).hexdigest(),'entry':'0x100254df8','continuation':'0x100254770','appearance':'0x100476ec0','cases':rows},indent=2)+'\n');print(json.dumps({'cases':len(rows),'moving':[{r['input']['name']:[c['name'] for c in r['calls']]} for r in rows if r['input']['velocity'][0]]}))
