"""Capture pool-ball ApplySpeed decisions from the pinned arm64 executable.
Usage: PYTHONPATH=/path/to/unicorn python3 scripts/research/native-pool-ball.py /path/to/executable
Requires unicorn==2.1.4. Turn integration, contact friction and audio calls are intercepted;
the routine's time splitting, translation, cushion/pocket tests and velocity writes execute natively.
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
SCRATCH=0x200000000;OBJECT=SCRATCH+0x1000;MATRIX=SCRATCH+0x2000;MODEL=SCRATCH+0x3000;COL=SCRATCH+0x4000;TIME=0x1007c44a0
u.mem_map(SCRATCH,0x40000)
def floats(at,count):return list(struct.unpack('<'+'f'*count,u.mem_read(at,count*4)))
def scalar(reg):return struct.unpack('<f',struct.pack('<I',u.reg_read(reg)))[0]
def write(at,values):u.mem_write(at,struct.pack('<'+'f'*len(values),*values))
events=[]
def hook(uc,addr,size,user):
 if addr==SCRATCH:uc.emu_stop();return
 if addr==0x100248694:pass # ApplyTurnSpeed: leave orientation unchanged.
 elif addr==0x100248fb4:
  p=uc.reg_read(UC_ARM64_REG_X1);events.append({'friction':scalar(UC_ARM64_REG_S0),'position':floats(p,3),'normal':floats(p+16,3)})
 elif addr==0x1001717b0:events.append({'audioEvent':uc.reg_read(UC_ARM64_REG_W1)})
 else:
  if not 0x100248828<=addr<0x100248fb4:raise RuntimeError('Unhandled native call '+hex(addr))
  return
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
u.hook_add(UC_HOOK_CODE,hook)
cases=[
 {'name':'free-roll','position':[0,.2,1],'velocity':[.1,.02,0]},
 {'name':'right-cushion','position':[.98,.2,1],'velocity':[.1,.02,0]},
 {'name':'left-cushion','position':[-.98,-.2,1],'velocity':[-.1,.02,0]},
 {'name':'top-cushion','position':[.2,.48,1],'velocity':[.02,.1,0]},
 {'name':'bottom-cushion','position':[-.2,-.48,1],'velocity':[.02,-.1,0]},
 {'name':'corner-pocket','position':[.98,.48,1],'velocity':[.1,.02,0]},
 {'name':'top-side-pocket','position':[0,.48,1],'velocity':[0,.1,0]},
 {'name':'bottom-side-pocket','position':[0,-.48,1],'velocity':[0,-.1,0]},
 {'name':'short-side-middle-cushion','position':[.98,0,1],'velocity':[.1,0,0]},
 {'name':'side-pocket-slow','position':[0,.499,1],'velocity':[0,.002,0]},
 {'name':'cushion-exact-predicted-edge','position':[.875,.25,1],'velocity':[.125,0,0]},
 {'name':'already-outside-moving-inward','position':[1.02,.25,1],'velocity':[-.1,0,0]},
 {'name':'impact-time-tie','position':[.98,.48,1],'velocity':[.1,.1,0]},
 {'name':'falling-above-catch','position':[0,.53,.9],'velocity':[0,.01,-.1],'gravity':True},
 {'name':'falling-through-catch','position':[0,.53,.72],'velocity':[.01,.01,-.1],'gravity':True},
 {'name':'falling-exact-catch','position':[0,.53,.825],'velocity':[0,0,-.125],'gravity':True},
]
for edge in [.0599,.06,.0601,-.0599,-.06,-.0601]:cases.append({'name':'side-pocket-cutoff-'+str(edge),'position':[edge,.48,1],'velocity':[0,.1,0]})
for edge in [.4399,.44,.4401]:cases.append({'name':'corner-cutoff-'+str(edge),'position':[.98,edge,1],'velocity':[.1,0,0]})
for dt in [.5,2]:cases.append({'name':'pocket-time-'+str(dt),'position':[0,.48,1],'velocity':[0,.1,0],'timeStep':dt})
for base in list(cases[:9]):
 c=dict(base);c['name']='rotated-'+base['name'];c['position']=[base['position'][1],base['position'][0],1];c['velocity']=[base['velocity'][1],base['velocity'][0],0];c['min']=[-.5,-1,.7];c['max']=[.5,1,.7];cases.append(c)
for case in cases:
 u.mem_write(OBJECT,bytes(0x1000));u.mem_write(OBJECT+0x18,struct.pack('<Q',MATRIX));u.mem_write(OBJECT+0x5a,bytes([4]));u.mem_write(OBJECT+0x64,struct.pack('<I',128| (2 if case.get('gravity')else 0)));u.mem_write(OBJECT+0x1ac,bytes([255]));write(MATRIX+0x30,case['position']);write(OBJECT+0x68,case['velocity']);write(TIME,[case.get('timeStep',1)]);write(0x1007c4a10,case.get('max',[1,.5,.7]));write(0x1007c4a1c,case.get('min',[-1,-.5,.7]));u.mem_write(0x100820b70,struct.pack('<Q',MODEL));u.mem_write(MODEL+0x30,struct.pack('<Q',COL));write(COL+0x24,[.037]);events=[]
 u.reg_write(UC_ARM64_REG_SP,SCRATCH+0x3f000);u.reg_write(UC_ARM64_REG_LR,SCRATCH);u.reg_write(UC_ARM64_REG_X0,OBJECT)
 u.emu_start(0x100248828,SCRATCH,count=10000)
 print(json.dumps({'input':case,'position':floats(MATRIX+0x30,3),'velocity':floats(OBJECT+0x68,3),'gravity':bool(struct.unpack('<I',u.mem_read(OBJECT+0x64,4))[0]&2),'lastWeaponDamage':u.mem_read(OBJECT+0x1ac,1)[0],'events':events,'restoredTimeStep':floats(TIME,1)[0]}))
