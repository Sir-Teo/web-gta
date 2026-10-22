"""Capture native pool contact/cloth friction and spin, with no simulated contact solver.
Usage: PYTHONPATH=/path/to/unicorn python3 scripts/research/native-pool-friction.py /path/to/executable
Requires unicorn==2.1.4. Arithmetic, speed/torque queries and friction accumulators execute
natively. powf uses host pow rounded to float32; surface friction effects return no sparks.
"""
import hashlib,json,math,struct,sys
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
SCRATCH=0x200000000;OBJECT=SCRATCH+0x1000;MATRIX=SCRATCH+0x2000;MODEL=SCRATCH+0x3000;COL=SCRATCH+0x4000;CONTACT=SCRATCH+0x5000
u.mem_map(SCRATCH,0x40000)
def floats(at,count):return list(struct.unpack('<'+'f'*count,u.mem_read(at,count*4)))
def write(at,values):u.mem_write(at,struct.pack('<'+'f'*len(values),*values))
def scalar(reg):return struct.unpack('<f',struct.pack('<I',u.reg_read(reg)))[0]
def set_float(reg,v):u.reg_write(reg,struct.unpack('<I',struct.pack('<f',v))[0])
def hook(uc,addr,size,user):
 if addr==SCRATCH:uc.emu_stop();return
 if addr==0x1004ed5e0:set_float(UC_ARM64_REG_S0,math.pow(scalar(UC_ARM64_REG_S0),scalar(UC_ARM64_REG_S1)))
 elif addr==0x100268658:uc.reg_write(UC_ARM64_REG_W0,0)
 else:
  if not any(lo<=addr<hi for lo,hi in [(0x100248fb4,0x1002493e4),(0x100248554,0x100248620),(0x1002494a8,0x100249680),(0x1002497cc,0x100249914),(0x1002cb230,0x1002cb2c8)]):raise RuntimeError('Unhandled native call '+hex(addr))
  return
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
u.hook_add(UC_HOOK_CODE,hook)
cases=[
 {'name':'rest','velocity':[0,0,0],'turn':[0,0,0]},
 {'name':'slide-east','velocity':[.04,0,0],'turn':[0,0,0]},
 {'name':'slide-north','velocity':[0,.04,0],'turn':[0,0,0]},
 {'name':'slide-diagonal','velocity':[.03,-.04,0],'turn':[0,0,0]},
 {'name':'roll-east','velocity':[.037,0,0],'turn':[0,1,0]},
 {'name':'topspin-east','velocity':[.04,0,0],'turn':[0,2,0]},
 {'name':'backspin-east','velocity':[.04,0,0],'turn':[0,-2,0]},
 {'name':'spin-vertical','velocity':[0,0,0],'turn':[0,0,.5]},
 {'name':'tiny-slide','velocity':[.000001,0,0],'turn':[0,0,0]},
 {'name':'falling-slide','velocity':[.04,0,-.03],'turn':[0,0,.1],'gravity':True},
 {'name':'pending-cushion-friction','velocity':[.04,0,0],'turn':[0,0,0],'frictionMove':[-.002,0,0],'frictionTurn':[0,.3,.02]},
]
for dt in [.5,2]:cases.append({'name':'slide-time-'+str(dt),'velocity':[.04,0,0],'turn':[0,0,.5],'timeStep':dt})
for position in [[2501,-1687,16.475],[1000.234,1000.345,1001.9]]:cases.append({'name':'world-height-'+str(position[2]),'position':position,'velocity':[.03,-.04,0],'turn':[.2,-.3,.4]})
for mass,turn_mass in [(5,.003),(10,.006)]:cases.append({'name':'mass-'+str(mass)+'-turn-'+str(turn_mass),'velocity':[.04,0,0],'turn':[0,0,0],'mass':mass,'turnMass':turn_mass})
for normal in [[-1,0,0],[1,0,0],[0,-1,0],[0,1,0]]:
 for turn in [[0,0,0],[.2,-.3,.4]]:
  cases.append({'name':'cushion-'+str(normal)+'-spin-'+str(turn),'stage':'contact','velocity':[.04,.03,0],'turn':turn,'normal':normal,'point':[-n*.037 for n in normal],'friction':.4})
for case in cases:
 u.mem_write(OBJECT,bytes(0x5000));u.mem_write(OBJECT+0x18,struct.pack('<Q',MATRIX));u.mem_write(OBJECT+0x5a,bytes([4]));u.mem_write(OBJECT+0x64,struct.pack('<I',128|(2 if case.get('gravity')else 0)));write(MATRIX,[1,0,0,0,0,1,0,0,0,0,1,0]);write(OBJECT+0xb0,[case.get('mass',10),case.get('turnMass',.003)]);write(OBJECT+0x68,case['velocity']);write(OBJECT+0x74,case['turn']);write(OBJECT+0x80,case.get('frictionMove',[0,0,0]));write(OBJECT+0x8c,case.get('frictionTurn',[0,0,0]));write(0x1007c44a0,[case.get('timeStep',1)]);u.mem_write(0x100820b70,struct.pack('<Q',MODEL));u.mem_write(MODEL+0x30,struct.pack('<Q',COL));write(COL+0x24,[.037]);write(CONTACT,case.get('point',[0,0,-.037]));write(CONTACT+16,case.get('normal',[0,0,1]));set_float(UC_ARM64_REG_S0,case.get('friction',.001));u.reg_write(UC_ARM64_REG_X0,OBJECT);u.reg_write(UC_ARM64_REG_X1,CONTACT);u.reg_write(UC_ARM64_REG_SP,SCRATCH+0x3f000);u.reg_write(UC_ARM64_REG_LR,SCRATCH)
 write(MATRIX+0x30,case.get('position',[0,0,0]));u.emu_start(0x100248fb4 if case.get('stage')=='contact'else 0x1002494a8,SCRATCH,count=20000)
 print(json.dumps({'input':case,'velocity':floats(OBJECT+0x68,3),'turn':floats(OBJECT+0x74,3),'frictionMove':floats(OBJECT+0x80,3),'frictionTurn':floats(OBJECT+0x8c,3)}))
