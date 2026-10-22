"""Capture native dead-ped pickup placement policy and float arithmetic.
Usage: PYTHONPATH=/path/to/unicorn python3 scripts/research/native-dead-ped-pickup.py /path/to/executable
Requires unicorn==2.1.4. RNG, sincosf, ground, player position, line and vehicle queries are
intercepted. Native candidate, pickup-pool scan, retry conditions and arithmetic execute.
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
import math
SCRATCH=0x200000000;POOL=0x10072f940;u.mem_map(SCRATCH,0x40000)
def f32(x):return struct.unpack('<f',struct.pack('<f',x))[0]
def getf(reg):return struct.unpack('<f',struct.pack('<I',u.reg_read(reg)))[0]
def putf(reg,value):u.reg_write(reg,struct.unpack('<I',struct.pack('<f',value))[0])
def point(addr):return list(struct.unpack('<3f',u.mem_read(addr,12)))
def hook(uc,addr,size,user):
 global draws
 if addr==0x1004ed718:
  uc.reg_write(UC_ARM64_REG_W0,case['draws'][draws%len(case['draws'])]);draws+=1
 elif addr==0x1004ecaf4:
  angle=getf(UC_ARM64_REG_S0);putf(UC_ARM64_REG_S0,math.sin(angle));putf(UC_ARM64_REG_S1,math.cos(angle))
 elif addr==0x100275188:
  groundQueries.append([getf(r)for r in [UC_ARM64_REG_S0,UC_ARM64_REG_S1,UC_ARM64_REG_S2]]);uc.mem_write(uc.reg_read(UC_ARM64_REG_X0),bytes([0 if case.get('noGround') else 1]));putf(UC_ARM64_REG_S0,case['ground'])
 elif addr==0x1002561e8:
  for r,v in zip([UC_ARM64_REG_S0,UC_ARM64_REG_S1,UC_ARM64_REG_S2],case['player']):putf(r,v)
 elif addr==0x10026e7e0:
  lines.append({'from':point(uc.reg_read(UC_ARM64_REG_X0)),'to':point(uc.reg_read(UC_ARM64_REG_X1)),'vehiclesAndObjects':bool(uc.reg_read(UC_ARM64_REG_W3))});uc.reg_write(UC_ARM64_REG_W0,0 if case.get('blockedLine') else 1)
 elif addr==0x1002759a4:
  spheres.append({'point':[getf(r)for r in [UC_ARM64_REG_S0,UC_ARM64_REG_S1,UC_ARM64_REG_S2]],'radius':getf(UC_ARM64_REG_S3)});uc.reg_write(UC_ARM64_REG_X0,1 if case.get('blockedVehicle') else 0)
 else:
  if not 0x1001c416c<=addr<0x1001c4454:raise RuntimeError('Unhandled native call '+hex(addr))
  return
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
u.hook_add(UC_HOOK_CODE,hook)
cases=[]
for angle in [0,32,64,128,192,255]:cases.append({'name':'angle-'+str(angle),'draws':[angle]})
cases.extend([
 {'name':'single-angle-not-independent-axes','draws':[64,0]},
 {'name':'no-ground-fallback','draws':[64,0],'noGround':True},
 {'name':'blocked-line-fallback','blockedLine':True},
 {'name':'near-player-relaxes-on-eighteenth','player':[10,21.5,0]},
 {'name':'vehicle-relaxes-on-eighteenth','blockedVehicle':True},
 {'name':'pickup-relaxes-on-eighteenth','blockPickup':[10,21.5,4.5]},
 {'name':'world-height-rounding','ped':[2495.9,-1707.4,1013.3],'ground':1012.8,'draws':[17]},
 {'name':'fractional-world','ped':[1000.12345,1001.9,9.3333],'ground':7.12345,'draws':[37]},
 {'name':'fractional-fallback','ped':[1000.12345,1001.9,9.3333],'noGround':True},
 {'name':'player-exactly-two','draws':[64],'player':[13.5,20,0]},
 {'name':'player-just-over-two','draws':[64],'player':[13.50001,20,0]},
])
rows=[]
for original in cases:
 case={'ped':[10,20,5],'player':[100,100,0],'ground':4,'draws':[0],**original};draws=0;groundQueries=[];lines=[];spheres=[]
 u.mem_write(POOL,bytes(620*36))
 if 'blockPickup'in case:u.mem_write(POOL+0x14,struct.pack('<3h',*[int(f32(x)*8)for x in case['blockPickup']]))
 for r,v in zip([UC_ARM64_REG_S0,UC_ARM64_REG_S1,UC_ARM64_REG_S2],case['ped']):putf(r,v)
 for r,offset in zip([UC_ARM64_REG_X0,UC_ARM64_REG_X1,UC_ARM64_REG_X2],[0x100,0x104,0x108]):u.reg_write(r,SCRATCH+offset)
 u.reg_write(UC_ARM64_REG_SP,SCRATCH+0x3f000);u.reg_write(UC_ARM64_REG_LR,SCRATCH);u.emu_start(0x1001c416c,SCRATCH,count=1000000)
 rows.append({'input':case,'point':point(SCRATCH+0x100),'draws':draws,'groundQueries':groundQueries,'lines':lines,'spheres':spheres})
print(json.dumps({'executableSha256':hashlib.sha256(f).hexdigest(),'function':'0x1001c416c','sincos':'Host sin/cos rounded to float32; native libm not independently validated','cases':rows},indent=2))
