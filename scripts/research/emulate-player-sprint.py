"""Capture pinned iOS player sprint controls, energy and stat capacity.

Control pad/vehicle queries are explicit logged input stubs. Native tables,
float/state instructions, energy handling, modifier/reset and sprint-result
routines execute unchanged. Requires Unicorn 2.1.4; no download.
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
for page in [0x100366000,0x100360000,0x100361000,0x100266000,0x100242000,0x100244000,0x100246000,0x100256000,0x100651000,0x10058c000,0x10058f000,0x100590000,0x100593000]:
 uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
uc.mem_map(0x1007bd000,0x2000);uc.mem_map(0x1007c4000,0x1000);uc.mem_map(0x20000000,0x10000)
ped=0x20000000;player=ped+0x1000;pad=ped+0x2000;vehicle=ped+0x3000;stack=ped+0xe000;sentinel=ped+0xf000
profile={};events=[]
def hook(uc,addr,size,unused):
 replies={0x100242cac:pad,0x1002467b8:int(profile['justPressed']),0x1002466d0:int(profile['held']),0x100256130:vehicle if profile['vehicle'] else 0,0x100244394:profile['axisX'],0x10024444c:profile['axisY']}
 if addr not in replies:return
 result=replies[addr];events.append({'address':hex(addr),'result':result});uc.reg_write(UC_ARM64_REG_X0,result);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
uc.hook_add(UC_HOOK_CODE,hook)
def f(value):return struct.unpack('<f',struct.pack('<f',value))[0]
def run(mode,energy,buttonSpeed,ts,held=False,justPressed=False,axisX=0,axisY=128,vehicle=False,neverTired=False,adrenaline=False,disabled=False):
 global profile,events
 profile={'held':held,'justPressed':justPressed,'axisX':axisX,'axisY':axisY,'vehicle':vehicle,'neverTired':neverTired,'adrenaline':adrenaline,'disabled':disabled};events=[]
 uc.mem_write(ped,bytes(0x10000));uc.mem_write(ped+0x540,struct.pack('<Q',player));uc.mem_write(player+0x24,struct.pack('<ff',energy,buttonSpeed));uc.mem_write(player+0x48,struct.pack('<H',2 if adrenaline else 0));uc.mem_write(player+0xa0,bytes([int(disabled)]));uc.mem_write(0x1007c47c8,bytes([int(neverTired)]));uc.mem_write(0x1007c44a0,struct.pack('<f',ts));uc.mem_write(0x1007c49f0,b'\0')
 uc.reg_write(UC_ARM64_REG_X0,ped);uc.reg_write(UC_ARM64_REG_X1,mode);uc.reg_write(UC_ARM64_REG_SP,stack);uc.reg_write(UC_ARM64_REG_LR,sentinel);uc.emu_start(0x10036626c,sentinel,count=1000)
 factor=struct.unpack('<f',struct.pack('<I',uc.reg_read(UC_ARM64_REG_S0)))[0];nextEnergy,nextSpeed=struct.unpack('<ff',uc.mem_read(player+0x24,8))
 return {'input':{'mode':mode,'energy':f(energy),'buttonSpeed':f(buttonSpeed),'timeStep':f(ts),**profile},'energy':nextEnergy,'buttonSpeed':nextSpeed,'factor':factor,'external':events.copy()}
rows=[run(mode,energy,speed,ts,held,pressed) for mode in range(4) for energy in [450,.01,0,-149.9,-150] for speed in [0,4,8] for ts in [.5,50/60,50/30] for held,pressed in [(False,False),(True,False),(True,True)]]
for mode in range(4):
 for flags in [{'neverTired':True},{'adrenaline':True},{'disabled':True},{'axisY':0},{'vehicle':True}]:rows.append(run(mode,450,8,1,held=True,**flags))
tables=[list(struct.unpack('<8f',data(0x100651264+i*32,32))) for i in range(4)]

capacities=[]
for stamina in [-1,0,100,500,1000]:
 uc.mem_write(0x1007bd9e4+0x58,struct.pack('<f',stamina));uc.mem_write(ped+0x540,struct.pack('<Q',player));uc.reg_write(UC_ARM64_REG_SP,stack);uc.reg_write(UC_ARM64_REG_LR,sentinel);uc.reg_write(UC_ARM64_REG_W0,7);uc.emu_start(0x100266300,sentinel,count=100)
 capacity=struct.unpack('<f',struct.pack('<I',uc.reg_read(UC_ARM64_REG_S0)))[0]
 uc.reg_write(UC_ARM64_REG_X0,ped);uc.reg_write(UC_ARM64_REG_SP,stack);uc.reg_write(UC_ARM64_REG_LR,sentinel);uc.emu_start(0x100366240,sentinel,count=200)
 capacities.append({'stamina':stamina,'capacity':capacity,'reset':struct.unpack('<f',uc.mem_read(player+0x24,4))[0]})
energyCases=[]
for sprint in [False,True]:
 for energy in [-150,-149.9,0,449.9,450,450.1]:
  for multiplier in [0,.3,1,3]:
   for ts in [.5,50/60,50/30]:
    uc.mem_write(player+0x24,struct.pack('<f',energy));uc.mem_write(player+0x48,b'\0\0');uc.mem_write(0x1007c47c8,b'\0');uc.mem_write(0x1007bd9e4+0x58,struct.pack('<f',100));uc.mem_write(0x1007c44a0,struct.pack('<f',ts));uc.reg_write(UC_ARM64_REG_X0,ped);uc.reg_write(UC_ARM64_REG_W1,int(sprint));uc.reg_write(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',multiplier))[0]);uc.reg_write(UC_ARM64_REG_SP,stack);uc.reg_write(UC_ARM64_REG_LR,sentinel);uc.emu_start(0x100360ad0,sentinel,count=200)
    energyCases.append({'input':{'sprint':sprint,'energy':f(energy),'multiplier':f(multiplier),'timeStep':f(ts),'capacity':450},'allowed':bool(uc.reg_read(UC_ARM64_REG_W0)),'energy':struct.unpack('<f',uc.mem_read(player+0x24,4))[0]})
results=[]
for mode in range(4):
 for speed in [0,.01,1,4.999999,5,5.000001,8,10]:
  uc.mem_write(player+0x28,struct.pack('<f',speed));uc.reg_write(UC_ARM64_REG_X0,ped);uc.reg_write(UC_ARM64_REG_X1,mode);uc.reg_write(UC_ARM64_REG_SP,stack);uc.reg_write(UC_ARM64_REG_LR,sentinel);uc.emu_start(0x100361af8,sentinel,count=100)
  results.append({'mode':mode,'buttonSpeed':f(speed),'result':struct.unpack('<f',struct.pack('<I',uc.reg_read(UC_ARM64_REG_S0)))[0]})
args.output.parent.mkdir(parents=True,exist_ok=True)
args.output.write_text(json.dumps({'source':'Pinned iOS native player sprint controller, energy, stat modifier/reset and result routines; only control pad/vehicle inputs use logged external stubs','sha256':sha256,'control':'0x10036626c','energyFunction':'0x100360ad0','capacityFunction':'0x100266300 mode 7','resetFunction':'0x100366240','resultFunction':'0x100361af8','tables':tables,'cases':rows,'capacities':capacities,'energyCases':energyCases,'results':results},indent=2)+'\n');print(json.dumps({'controls':len(rows),'capacities':len(capacities),'energyCases':len(energyCases),'results':len(results)}))
