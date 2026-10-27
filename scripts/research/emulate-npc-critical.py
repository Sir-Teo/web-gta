"""Emulate the pinned iOS nonplayer firearm critical branch; optional reference captures.

Requires Unicorn 2.1.4. Does not execute the host implementation or download a binary.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
from unicorn import Uc, UC_ARCH_ARM64, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm64_const import UC_ARM64_REG_X0, UC_ARM64_REG_X1, UC_ARM64_REG_X2, UC_ARM64_REG_SP, UC_ARM64_REG_X30, UC_ARM64_REG_W0

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--binary',required=True,type=Path)
parser.add_argument('--output',type=Path,help='Write all native observations as JSON')
parser.add_argument('--fixture',type=Path,help='Write the compact standing/player reference cases')
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
 vm,fo,fsz=next(s for s in segments if s[0]<=addr<s[0]+s[2]);return b[off+fo+addr-vm:off+fo+addr-vm+n]
uc=Uc(UC_ARCH_ARM64,UC_MODE_ARM)
for page in [0x10028a000,0x100323000]:uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
uc.mem_map(0x1004ed000,0x1000);uc.mem_write(0x1004ed718,bytes.fromhex('c0035fd6'))
uc.mem_map(0x20000000,0x10000);uc.mem_map(0x30000000,0x10000);uc.mem_map(0x40000000,0x1000)
state={'sample':0,'calls':0}
def random(uc,addr,size,user):
 state['calls']+=1;uc.reg_write(UC_ARM64_REG_W0,state['sample'])
uc.hook_add(UC_HOOK_CODE,random,begin=0x1004ed718,end=0x1004ed718)
def run(weapon,piece,sample,stance='foot',no_critical=False,creator='ped'):
 uc.mem_write(0x20000000,bytes(0x5000));calc,victim,source=0x20000000,0x20001000,0x20002000
 uc.mem_write(calc,struct.pack('<QfII',0 if creator=='null' else source,25,piece,weapon))
 uc.mem_write(victim+0x720,struct.pack('<I',0 if stance=='player' else 1 if stance=='player2' else 4));uc.mem_write(victim+0x589,bytes([16 if no_critical else 0]))
 if stance=='car':uc.mem_write(victim+0x585,b'\1');uc.mem_write(victim+0x708,struct.pack('<Q',0x20004000))
 uc.mem_write(source+0x5a,bytes([3 if creator=='ped' else 2]));uc.mem_write(source+0x720,struct.pack('<I',7))
 state.update(sample=sample,calls=0)
 for reg,value in [(UC_ARM64_REG_X0,calc),(UC_ARM64_REG_X1,victim),(UC_ARM64_REG_X2,0x20003000),(UC_ARM64_REG_SP,0x3000fff0),(UC_ARM64_REG_X30,0x40000000)]:uc.reg_write(reg,value)
 uc.emu_start(0x10028a4b0,0x40000000,count=1000)
 return {'critical':bool(uc.reg_read(UC_ARM64_REG_W0)),'randomCalls':state['calls']}
rows=[]
for stance in ['foot','car','player','player2']:
 for creator in ['ped','vehicle','null']:
  for no_critical in [False,True]:
   for weapon in [*range(22,35),38,52]:
    for piece in [3,9]:
     results=[run(weapon,piece,sample,stance,no_critical,creator) for sample in range(8)]
     rows.append(dict(stance=stance,creator=creator,noCritical=no_critical,weapon=weapon,piece=piece,results=results))
reference={'sha256':sha256,'function':'0x10028a4b0','cases':rows}
cases=[]
for c in rows:
 if c['creator']!='ped' or c['stance']=='car':continue
 calls={v['randomCalls'] for v in c['results']}
 if len(calls)!=1:raise ValueError('Unexpected sample-dependent RNG consumption.')
 cases.append({k:c[k] for k in ['stance','weapon','piece','noCritical']}|{'forceMask':sum(1<<i for i,v in enumerate(c['results']) if v['critical']),'randomCalls':calls.pop()})
fixture={'source':'Pinned iOS arm64 machine code executed with Unicorn 2.1.4; RNG stub samples 0..7; nonplayer ped source','sha256':sha256,'function':'0x10028a4b0','cases':cases}
for path,value in [(args.output,reference),(args.fixture,fixture)]:
 if path:
  path.parent.mkdir(parents=True,exist_ok=True)
  path.write_text(json.dumps(value,indent=2)+'\n')
print(json.dumps({'sha256':sha256,'nativeCalls':len(rows)*8,'nativeCases':len(rows),'fixtureCases':len(cases)}))
