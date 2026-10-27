"""Capture CWeapon::DoDriveByAutoAiming with declared world query results.

Actual target scoring, DistToLine, GetPlaneGunsAutoAimAngle and endpoint
writes execute. World query membership/order and stack canary are declared
inputs. Imported host-libm tanf is external for aircraft angle thresholds.
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
parser.add_argument('--profiles',type=Path,help='Append observed live input profiles to the fixed native cases.')
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

from unicorn import UC_HOOK_CODE,UC_HOOK_MEM_INVALID
import ctypes
libm=ctypes.CDLL('libm.so.6');libm.tanf.argtypes=[ctypes.c_float];libm.tanf.restype=ctypes.c_float
uc=Uc(UC_ARCH_ARM64,UC_MODE_ARM)
for page in [0x100498000,0x100483000,0x10017f000,0x100180000,0x10058f000,0x100590000,0x10058c000]:
 uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
uc.mem_map(0x100273000,0x1000);uc.mem_map(0x1004ed000,0x1000);uc.mem_map(0x1005ac000,0x1000);uc.mem_map(0x20000000,0x40000)
vehicle,owner,start,end=0x20000000,0x20002000,0x20003000,0x20003040
profile={};queries=[];metrics=[];choice={};accepted=False;power=[]
def f(x):return struct.unpack('<f',struct.pack('<f',x))[0]
def scalar(reg):return struct.unpack('<f',struct.pack('<I',uc.reg_read(reg)))[0]
def hook(uc,addr,size,user):
 global accepted,choice
 if addr==0x10027332c:
  kind='peds' if uc.reg_read(UC_ARM64_REG_W7) else 'vehicles';rows=profile[kind][:16];out=uc.reg_read(UC_ARM64_REG_X4);uc.mem_write(uc.reg_read(UC_ARM64_REG_X2),struct.pack('<h',len(rows)))
  for i,p in enumerate(rows):uc.mem_write(out+i*8,struct.pack('<Q',p))
  queries.append({'kind':kind,'range':scalar(UC_ARM64_REG_S0),'count':len(rows)});uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR));return
 if addr==0x1004ed9e8:
  value=scalar(UC_ARM64_REG_S0);result=libm.tanf(value);power.append({'input':value,'output':result});uc.reg_write(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',result))[0]);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR));return
 if addr==0x100498738:metrics.append({'index':uc.reg_read(UC_ARM64_REG_W24),'lineDistance':scalar(UC_ARM64_REG_S0)})
 if addr==0x10049889c:choice={'index':uc.reg_read(UC_ARM64_REG_W23),'score':scalar(UC_ARM64_REG_S8),'threshold':scalar(UC_ARM64_REG_S0)}
 if addr==0x1004988a8:accepted=True
uc.hook_add(UC_HOOK_CODE,hook)
def fault(uc,access,addr,size,value,user):print('fault',hex(uc.reg_read(UC_ARM64_REG_PC)),hex(addr));return False
uc.hook_add(UC_HOOK_MEM_INVALID,fault)
def capture(peds=None,vehicles=None,startPoint=[0,0,1],endPoint=[0,35,1],ownerPosition=[0,0,1],vehiclePosition=[0,0,0],subtype=9,model=481,aimVehicles=False,hasOwner=True):
 global profile,choice,accepted
 peds=peds or [];vehicles=vehicles or [];profile={'peds':[],'vehicles':[]};queries.clear();metrics.clear();power.clear();choice={};accepted=False;uc.mem_write(vehicle,bytes(0x40000));uc.mem_write(0x1005ac870,struct.pack('<Q',0x20003a00));uc.mem_write(0x20003a00,struct.pack('<Q',0x12345678));uc.mem_write(vehicle+8,struct.pack('<3f',*vehiclePosition));uc.mem_write(owner+8,struct.pack('<3f',*ownerPosition));uc.mem_write(vehicle+0x32,struct.pack('<h',model));uc.mem_write(vehicle+0x738,struct.pack('<I',subtype));uc.mem_write(start,struct.pack('<3f',*startPoint));uc.mem_write(end,struct.pack('<3f',*endPoint))
 for i,(kind,row) in enumerate([*[("peds",r) for r in peds],*[("vehicles",r) for r in vehicles]]):
  ptr=owner if row.get('self') else 0x20010000+i*0x800
  uc.mem_write(ptr+8,struct.pack('<3f',*row['position']));uc.mem_write(ptr+0x5a,bytes([3 if kind=='peds' else 2]));uc.mem_write(ptr+0x54c,struct.pack('<I',row.get('state',0)));uc.mem_write(ptr+0x150,struct.pack('<Q',vehicle if row.get('sameVehicle') else 0))
  if row.get('matrix'):
   mat=ptr+0x600;uc.mem_write(ptr+0x18,struct.pack('<Q',mat));uc.mem_write(mat+0x30,struct.pack('<3f',*row['position']))
  profile[kind].append(ptr)
 uc.reg_write(UC_ARM64_REG_SP,0x2003f000);uc.reg_write(UC_ARM64_REG_X0,owner if hasOwner else 0);uc.reg_write(UC_ARM64_REG_X1,vehicle);uc.reg_write(UC_ARM64_REG_X2,start);uc.reg_write(UC_ARM64_REG_X3,end);uc.reg_write(UC_ARM64_REG_W4,int(aimVehicles));uc.reg_write(UC_ARM64_REG_LR,0x2003e000);uc.emu_start(0x10049859c,0x2003e000,count=20000)
 if uc.reg_read(UC_ARM64_REG_PC)!=0x2003e000:raise RuntimeError('Auto-aim did not return.')
 return {'input':{'peds':peds,'vehicles':vehicles,'start':list(map(f,startPoint)),'end':list(map(f,endPoint)),'owner':list(map(f,ownerPosition)),'vehicle':list(map(f,vehiclePosition)),'subtype':subtype,'model':model,'aimVehicles':aimVehicles,'hasOwner':hasOwner},'end':list(struct.unpack('<3f',uc.mem_read(end,12))),'choice':{**choice,'accepted':accepted},'queries':queries.copy(),'metrics':metrics.copy(),'tanfCalls':power.copy()}
rows=[]
for model,subtype in [(481,10),(461,9),(471,2),(520,4),(519,4)]:
 for x in [0,.5,1,2,3,5]:
  for y in [-10,0,5,10,16,17,30]:
   for z in [0,1,3]:rows.append(capture([{'position':[x,y,z]}],model=model,subtype=subtype))
for state in [0,53,54,55,56]:
 for matrix in [False,True]:rows.append(capture([{'position':[0,10,1],'state':state,'matrix':matrix}]))
for row in [{'position':[0,0,1],'self':True},{'position':[0,10,1],'sameVehicle':True}]:rows.append(capture([row,{'position':[.5,8,1]}]))
for peds in [[{'position':[1,10,1]},{'position':[0,10,1]}],[{'position':[0,10,1]},{'position':[0,10,1]}],[{'position':[0,-5,1]}]*16+[{'position':[0,5,1]}]]:rows.append(capture(peds))
for aim in [False,True]:rows.append(capture([{'position':[1,10,1]}],[{'position':[0,5,1]}],aimVehicles=aim))
rows.extend([capture(),capture(hasOwner=False),capture(endPoint=[0,0,1])])
for model in [425,447,464,476,487,497,548,564,576]:
 for p in [[1,10,1],[3,10,1]]:rows.append(capture([{'position':p}],model=model,subtype=3))
if args.profiles:
 for row in json.loads(args.profiles.read_text()):
  values=row['nativeInput'].copy()
  for old,new in [('start','startPoint'),('end','endPoint'),('owner','ownerPosition'),('vehicle','vehiclePosition')]:
   if old in values:values[new]=values.pop(old)
  rows.append(capture(**values))
args.output.write_text(json.dumps({'source':'Actual DoDriveByAutoAiming and actual DistToLine/GetPlaneGunsAutoAimAngle. World query result lists and stack canary declared; imported host-libm tanf external; caller spatial query membership/order is not emulated','sha256':sha256,'entry':'0x10049859c','lineDistance':'0x10017fd10','angleLookup':'0x100483b34','cases':rows},indent=2)+'\n');print(json.dumps({'cases':len(rows)}))
