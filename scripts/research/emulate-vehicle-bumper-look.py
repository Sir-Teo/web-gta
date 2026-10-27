"""Capture actual native first-person vehicle side and rear look routines.

MODE_1STPERSON LookRight 0x10021f500 / LookBehind 0x10021ed60,
actual CVector normalize/cross and GetVectorsReadyForRW execute. Vehicle
appearance, boat pose/bone services and the near-raster setter are declared
external. Selected matrices, initial camera vectors and driver presence are
inputs. No camera source/basis arithmetic is replaced. Retail-PC camera/task
and rendering equivalence is not established by this selected iOS capture.
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
for page in [0x10021e000,0x10021f000,0x1002cb000,0x10058c000,0x10058f000,0x100590000,0x100592000,0x100593000,0x100648000]:
 uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
for page in [0x1000f9000,0x100476000,0x100329000,0x10032b000,0x100236000,0x1008e1000]:uc.mem_map(page,0x1000)
uc.mem_map(0x20000000,0x10000)
camera,vehicle,matrix,driver,stack,stop=0x20000000,0x20001000,0x20002000,0x20003000,0x20008000,0x2000f000
profile={};near=None;bones=[];trace=[]
def hook(uc,address,size,user):
 global near
 trace.append(address)
 if address==0x1000f9948:near=struct.unpack('<f',struct.pack('<I',uc.reg_read(UC_ARM64_REG_S0)))[0]
 elif address==0x100476ec0:uc.reg_write(UC_ARM64_REG_W0,profile['appearance'])
 elif address==0x100329034:
  bones.append({'id':uc.reg_read(UC_ARM64_REG_W2),'update':uc.reg_read(UC_ARM64_REG_W3)})
  uc.mem_write(uc.reg_read(UC_ARM64_REG_X1),struct.pack('<3f',*profile['neck']))
 elif address not in [0x10032bd40,0x100236f5c,0x100236f70]:return
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
uc.hook_add(UC_HOOK_CODE,hook)
def capture(i):
 global profile,near,bones,trace
 profile=i;near=None;bones=[];trace=[];uc.mem_write(0x20000000,bytes(0x10000));uc.mem_write(0x1008e1208,struct.pack('<Q',0x20007000))
 uc.mem_write(camera+0xe,struct.pack('<H',16));uc.mem_write(camera+0x1f8,struct.pack('<Q',vehicle));uc.mem_write(vehicle+0x18,struct.pack('<Q',matrix));uc.mem_write(vehicle+0x5a,bytes([2]));uc.mem_write(vehicle+0x734,struct.pack('<I',i['vehicleType']));uc.mem_write(vehicle+0x5a0,struct.pack('<Q',driver if i['driver'] else 0))
 for j,k in enumerate(['right','forward','up','position']):uc.mem_write(matrix+j*16,struct.pack('<3f',*i['matrix'][k]))
 for address,key in [(0x168,'front'),(0x174,'source'),(0x18c,'up')]:uc.mem_write(camera+address,struct.pack('<3f',*i[key]))
 uc.reg_write(UC_ARM64_REG_SP,stack);uc.reg_write(UC_ARM64_REG_X0,camera);uc.reg_write(UC_ARM64_REG_W1,int(i['right']));uc.reg_write(UC_ARM64_REG_LR,stop)
 try:uc.emu_start(0x10021ed60 if i['behind'] else 0x10021f500,stop,count=3000)
 except Exception as error:raise RuntimeError(f'{error}; pc={uc.reg_read(UC_ARM64_REG_PC):#x}; trace={[hex(a) for a in trace[-12:]]}') from error
 if uc.reg_read(UC_ARM64_REG_PC)!=stop:raise RuntimeError('Did not return')
 return {'input':i,'source':list(struct.unpack('<3f',uc.mem_read(camera+0x174,12))),'front':list(struct.unpack('<3f',uc.mem_read(camera+0x168,12))),'up':list(struct.unpack('<3f',uc.mem_read(camera+0x18c,12))),'near':near,'boneCalls':bones.copy(),'lookFlags':list(uc.mem_read(camera+7,3))}
def multiply(a,b):return [[sum(a[r][k]*b[k][c] for k in range(3)) for c in range(3)] for r in range(3)]
def basis(yaw,pitch,roll,scaled=False):
 c,s=math.cos(yaw),math.sin(yaw);a=[[c,-s,0],[s,c,0],[0,0,1]]
 c,s=math.cos(pitch),math.sin(pitch);a=multiply(a,[[1,0,0],[0,c,-s],[0,s,c]])
 c,s=math.cos(roll),math.sin(roll);a=multiply(a,[[c,0,s],[0,1,0],[-s,0,c]])
 scales=[1.2,.8,1.1] if scaled else [1,1,1]
 return [[a[r][col]*scales[col] for r in range(3)] for col in range(3)]
def unit(v):
 length=math.sqrt(sum(x*x for x in v));return [x/length for x in v]
bases=[basis(0,0,0),basis(.7,0,0),basis(-2.3,.45,-.35),basis(math.pi,-.8,.6),basis(.7,.35,-.4,True),[[1,0,0],[0,0,1],[0,-1,0]]]
profiles=[]
for kind,rows,position,look,driverPresent,lean in itertools.product([0,5,9],bases,[[0,0,0],[2493,-1683,13.3]],[(False,False),(False,True),(True,False)],[False,True],[0,.4]):
 right,forward,up=rows;camUp=[unit(up)[j]*math.cos(lean)+unit(right)[j]*math.sin(lean) for j in range(3)]
 profiles.append({'vehicleType':kind,'appearance':{0:1,5:4,9:2}[kind],'behind':look[0],'right':look[1],'driver':driverPresent,'neck':[position[0]+.2,position[1]-.1,position[2]+1.8],'source':[position[0]+.1,position[1]+.4,position[2]+1.6],'front':unit(forward),'up':camUp,'matrix':dict(zip(['right','forward','up','position'],[right,forward,up,position]))})
fixed=len(profiles)
if args.profiles:
 supplied=json.loads(args.profiles.read_text());supplied=supplied.get('rows',[]) if isinstance(supplied,dict) else supplied
 for row in supplied:profiles.append(row['nativeInput'])
cases=[capture(i) for i in profiles]
args.output.write_text(json.dumps({'source':__doc__,'sha256':digest,'entries':{'side':'0x10021f500','behind':'0x10021ed60','basis':'0x10021fbfc','normalize':'0x1002cb4c4','cross':'0x1002cb230'},'externalServices':['GetVehicleAppearance 0x100476ec0','Near-raster setter 0x1000f9948','Boat transformed neck 0x100329034','Boat pose updates 0x10032bd40 / 0x100236f5c / 0x100236f70'],'fixedCases':fixed,'cases':cases},indent=2)+'\n');print(json.dumps({'fixed':fixed,'cases':len(cases)}))
