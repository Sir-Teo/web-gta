"""Capture the pinned iOS inlined NPC armour calculation with Unicorn 2.1.4.

Executes only 0x100289d30..0x100289dc8, before ComputeWillKillPed. FindPlayerPed
returns null to select the NPC path; no host calculation is used. No download.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
from unicorn import Uc, UC_ARCH_ARM64, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm64_const import UC_ARM64_REG_X0, UC_ARM64_REG_X19, UC_ARM64_REG_X20, UC_ARM64_REG_X21

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
uc.mem_map(0x100289000,0x1000);uc.mem_write(0x100289000,data(0x100289000,0x1000))
uc.mem_map(0x100255000,0x1000);uc.mem_write(0x100255e24,bytes.fromhex('c0035fd6'))
uc.mem_map(0x20000000,0x4000)
def no_player(uc,addr,size,user):uc.reg_write(UC_ARM64_REG_X0,0)
uc.hook_add(UC_HOOK_CODE,no_player,begin=0x100255e24,end=0x100255e24)

def run(weapon,damage,armour):
 calc,victim,response=0x20000000,0x20001000,0x20003000
 uc.mem_write(0x20000000,bytes(0x4000))
 uc.mem_write(calc+8,struct.pack('<f',damage));uc.mem_write(calc+16,struct.pack('<I',weapon))
 uc.mem_write(victim+0x6b4,struct.pack('<f',armour))
 for reg,value in [(UC_ARM64_REG_X19,victim),(UC_ARM64_REG_X20,calc),(UC_ARM64_REG_X21,response)]:uc.reg_write(reg,value)
 uc.emu_start(0x100289d30,0x100289dc8,count=100)
 read=lambda addr:struct.unpack('<f',uc.mem_read(addr,4))[0]
 return {'weapon':weapon,'damage':damage,'armour':armour,'remainingArmour':read(victim+0x6b4),'damageHealth':read(calc+8),'damageArmour':read(response+4)}

rows=[run(weapon,damage,armour) for weapon in [0,1,3,22,53,54] for damage in [0,.1,6.6,27.5,41] for armour in [0,1,27,40]]
fixture={'source':'Pinned iOS arm64 instructions executed with Unicorn 2.1.4; NPC victim; FindPlayerPed returns null','sha256':sha256,'region':['0x100289d30','0x100289dc8'],'cases':rows}
args.output.parent.mkdir(parents=True,exist_ok=True)
args.output.write_text(json.dumps(fixture,indent=2)+'\n')
print(json.dumps({'sha256':sha256,'nativeCases':len(rows),'region':fixture['region']}))
