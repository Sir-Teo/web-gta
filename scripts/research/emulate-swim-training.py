"""Capture pinned iOS swimming training counters and stat mutations.

Native CStats::UpdateStatsWhenSwimming executes unchanged except logged
external physiology/HUD calls. Requires Unicorn 2.1.4 and the pinned binary;
no download. AR_STATS.DAT is the packaged game configuration.
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
for page in [0x100265000,0x100260000,0x1002b0000,0x10058c000,0x100590000,0x10064a000]:
 uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
uc.mem_map(0x1007bd000,0x2000);uc.mem_map(0x1007c4000,0x1000);uc.mem_map(0x20000000,0x10000)
values=[0.0]*59
for line in Path('public/play/world/files/data/ar_stats.dat').read_text().splitlines():
 t=line.split()
 if len(t)>=3 and t[0].isdigit():values[int(t[0])]=float(t[2])
uc.mem_write(0x1007bdea8,struct.pack('<59f',*values))
events=[]
def hook(uc,addr,size,unused):
 if addr not in [0x100265280,0x100260300,0x1002b0620]:return
 events.append({'address':hex(addr),'w0':uc.reg_read(UC_ARM64_REG_W0),'w1':uc.reg_read(UC_ARM64_REG_W1)})
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
uc.hook_add(UC_HOOK_CODE,hook)
rows=[]
for underwater in [False,True]:
 for sprinting in [False,True]:
  for swimCounter,breathCounter in [(0,0),(180000,60000),(180001,60001),(180001,0)]:
   for ts in [0.5,1,50/30]:
    for stamina,lung,energy in [(100,0,0),(999,999,-1)]:
     events=[]
     uc.mem_write(0x1007bea0c,struct.pack('<II',swimCounter,breathCounter));uc.mem_write(0x1007bd9e4+21*4,struct.pack('<ff',100,stamina));uc.mem_write(0x1007bdb2c+(225-120)*4,struct.pack('<i',lung));uc.mem_write(0x1007bdb2c+(165-120)*4,struct.pack('<i',energy));uc.mem_write(0x1007c44a0,struct.pack('<f',ts));uc.mem_write(0x10064a04c,b'\1')
     uc.reg_write(UC_ARM64_REG_SP,0x2000e000);uc.reg_write(UC_ARM64_REG_LR,0x2000f000);uc.reg_write(UC_ARM64_REG_W0,int(underwater));uc.reg_write(UC_ARM64_REG_W1,int(sprinting));uc.emu_start(0x100265a34,0x2000f000,count=1000)
     nextSwim,nextBreath=struct.unpack('<II',uc.mem_read(0x1007bea0c,8));fat,nextStamina=struct.unpack('<ff',uc.mem_read(0x1007bd9e4+21*4,8));nextLung=struct.unpack('<i',uc.mem_read(0x1007bdb2c+(225-120)*4,4))[0]
     rows.append({'input':{'underwater':underwater,'sprinting':sprinting,'swimCounter':swimCounter,'breathCounter':breathCounter,'timeStep':struct.unpack('<f',struct.pack('<f',ts))[0],'stamina':stamina,'lung':lung,'energy':energy,'fat':100},'swimCounter':nextSwim,'breathCounter':nextBreath,'stamina':nextStamina,'lung':nextLung,'fat':fat,'external':events.copy()})
args.output.write_text(json.dumps({'source':'Pinned iOS CStats::UpdateStatsWhenSwimming; actual counters and stat mutation, logged external UpdateFatAndMuscleStats/CheckForStatsMessage/DisplayScriptStatUpdateMessage stubs','sha256':sha256,'function':'0x100265a34','configuration':values,'cases':rows},indent=2)+'\n');print(json.dumps({'cases':len(rows),'example':rows[-7]}))
