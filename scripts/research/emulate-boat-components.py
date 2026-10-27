"""Capture pinned iOS boat propeller/alpha instructions with Unicorn 2.1.4.

Executes 0x10045b2d0..0x10045b354 and the actual alpha byte callback
0x10047e758. Reads the boat descriptor table directly. No host arithmetic
replaces the captured calculation; no download.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
from unicorn import Uc, UC_ARCH_ARM64, UC_MODE_ARM
from unicorn.arm64_const import UC_ARM64_REG_X0, UC_ARM64_REG_X1, UC_ARM64_REG_X19, UC_ARM64_REG_X20, UC_ARM64_REG_X21

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

uc=Uc(UC_ARCH_ARM64,UC_MODE_ARM)
for page in [0x10045b000,0x10047e000,0x10058c000,0x10058e000,0x100593000]:
 uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
uc.mem_map(0x1007c4000,0x1000);uc.mem_map(0x20000000,0x3000)

def alpha_byte(value):
 material=0x20002000;uc.mem_write(material+8,bytes([17,34,51,100]))
 uc.reg_write(UC_ARM64_REG_X0,material);uc.reg_write(UC_ARM64_REG_X1,value)
 uc.emu_start(0x10047e758,0x10047e75c,count=1)
 color=list(uc.mem_read(material+8,4))
 if color[:3]!=[17,34,51]:raise ValueError('Native alpha callback changed RGB.')
 return color[3]

def run(speed,angle,time_step):
 boat=0x20000000;uc.mem_write(boat,bytes(0x1000))
 uc.mem_write(boat+0x75c,struct.pack('<f',speed));uc.mem_write(boat+0x760,struct.pack('<f',angle))
 uc.mem_write(0x1007c44a0,struct.pack('<f',time_step));uc.reg_write(UC_ARM64_REG_X19,boat)
 uc.emu_start(0x10045b2d0,0x10045b354,count=200)
 static=uc.reg_read(UC_ARM64_REG_X21);moving=uc.reg_read(UC_ARM64_REG_X20)
 result_angle=struct.unpack('<f',uc.mem_read(boat+0x760,4))[0]
 return {'engineSpeed':struct.unpack('<f',struct.pack('<f',speed))[0],'angle':struct.unpack('<f',struct.pack('<f',angle))[0],'timeStep':time_step,'nextAngle':result_angle,'staticAlpha':alpha_byte(static),'movingAlpha':alpha_byte(moving)}

rows=[run(speed,angle,ts) for speed in [0,.01,.05,.0808,.0809,.1,.18,.1963495,.25,.34,.5] for angle in [0,6.25,6.2831854820251465] for ts in [0,.5,1,3]]
descriptors=[]
for address in range(0x10064c018,0x10064c138,16):
 ptr,node,flags=struct.unpack('<QII',data(address,16))
 name=bytearray();cursor=ptr
 while True:
  char=data(cursor,1)[0]
  if not char:break
  name.append(char);cursor+=1
 descriptors.append({'name':name.decode('ascii'),'node':node,'flags':flags})
fixture={'source':'Pinned iOS arm64 CBoat::PreRender and actual SetCompAlphaCB executed with Unicorn 2.1.4; descriptor bytes read directly','sha256':sha256,'region':['0x10045b2d0','0x10045b354'],'alphaCallback':'0x10047e758','descriptors':descriptors,'cases':rows}
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(fixture,indent=2)+'\n')
print(json.dumps({'nativeCases':len(rows),'descriptors':len(descriptors),'sha256':sha256}))
