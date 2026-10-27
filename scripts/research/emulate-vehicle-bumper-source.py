"""Capture the pinned native vehicle camera's dummy/source stage.

Executes Process_1stPerson 0x100217890 through its model dummy selection,
offsets, actual CMatrix::TransformVector and position addition. Boat world-Z
lift also executes. Stops before bike neck/LOS and upside-down protection.
Vehicle/model type, dummy slots and the selected matrix are declared inputs;
the earlier bike lean-matrix selection is outside this stage.
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
for page in [0x100217000,0x1002cb000,0x100592000,0x100593000]:uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
uc.mem_map(0x100820000,0x2000);uc.mem_map(0x20000000,0x10000)
camera,vehicle,matrix,model,structure,stack=0x20000000,0x20001000,0x20002000,0x20003000,0x20004000,0x20008000
def stop(uc,address,size,user):
 if address in [0x100217968,0x100217a90]:uc.emu_stop()
uc.hook_add(UC_HOOK_CODE,stop)
def capture(i):
 uc.mem_write(0x20000000,bytes(0x10000));uc.mem_write(0x100820b70,struct.pack('<Q',model))
 kind=i['vehicleType'];uc.mem_write(model+0x6c,struct.pack('<I',i.get('modelType',kind)));uc.mem_write(model+0x90,struct.pack('<Q',structure))
 # Distinct unselected slot verifies the type-dependent read, not just arithmetic.
 uc.mem_write(structure,struct.pack('<3f',91,92,93));uc.mem_write(structure+0x30,struct.pack('<3f',81,82,83))
 uc.mem_write(structure+(0 if i.get('modelType',kind)==5 else 0x30),struct.pack('<3f',*i['dummy']))
 for j,key in enumerate(['right','forward','up','position']):uc.mem_write(matrix+j*16,struct.pack('<3f',*i['matrix'][key]))
 uc.mem_write(vehicle+0x18,struct.pack('<Q',matrix));uc.mem_write(vehicle+0x734,struct.pack('<I',kind));uc.mem_write(camera+0x1f8,struct.pack('<Q',vehicle))
 for reg,value in [(UC_ARM64_REG_X19,camera),(UC_ARM64_REG_X20,matrix),(UC_ARM64_REG_X21,vehicle),(UC_ARM64_REG_SP,stack)]:uc.reg_write(reg,value)
 uc.emu_start(0x100217890,0x2000f000,count=1000)
 boundary=uc.reg_read(UC_ARM64_REG_PC)
 if boundary not in [0x100217968,0x100217a90]:raise RuntimeError(f'Unexpected stage end {boundary:#x}')
 return {'input':i,'source':list(struct.unpack('<3f',uc.mem_read(camera+0x174,12))),'fov':struct.unpack('<f',uc.mem_read(camera+0x8c,4))[0],'boundary':hex(boundary)}
profiles=[]
for kind,angle,dummy,position in itertools.product([0,5,9],[0,.4,1.2,-2.3],[[.7,.25,1.1],[-.6,-.4,.8],[0,0,0]],[[0,0,0],[2600,-2600,13.3]]):
 c,s=math.cos(angle),math.sin(angle);profiles.append({'vehicleType':kind,'dummy':dummy,'matrix':{'right':[c,s,0],'forward':[-s*.8,c*.8,.6],'up':[s*.6,-c*.6,.8],'position':position}})
fixed=len(profiles)
if args.profiles:
 rows=json.loads(args.profiles.read_text());rows=rows.get('rows',[]) if isinstance(rows,dict) else rows
 for r in rows:
  i=r.get('nativeInput')
  if i is None:
   source=r['sourceInput'];i={'matrix':source['matrix'],'dummy':source['dummy'],'vehicleType':5 if source['boat'] else 0 if r.get('quad') else 9}
  profiles.append(i)
cases=[capture(i) for i in profiles]
args.output.write_text(json.dumps({'source':__doc__,'sha256':digest,'entry':'0x100217890','transform':'0x1002cb268','fixedCases':fixed,'cases':cases},indent=2)+'\n');print(json.dumps({'fixed':fixed,'cases':len(cases)}))
