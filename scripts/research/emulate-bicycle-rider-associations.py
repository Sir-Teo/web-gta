"""Capture selected CBmx association writes plus actual native blend/synchronization/scalar clump updates.

Stops before fallback crank/pose work; ordinary CBike fallback, zero-node
allocation, asset decompression and frame effects are declared stubs.
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

from unicorn import UC_HOOK_CODE
uc=Uc(UC_ARCH_ARM64,UC_MODE_ARM)
for page in [0x10013c000,0x10013d000,0x100138000,0x100139000,0x10058e000]:uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
uc.mem_map(0x100689000,0x2000);uc.mem_map(0x20000000,0x20000)
clump,clumpData,groups,static,stack=0x20000000,0x20000100,0x20000200,0x20000400,0x2001f000
pointers={};events=[];created=[];group=3;nextIndex=0
def f(x):return struct.unpack('<f',struct.pack('<f',x))[0]
def flags(identifier):return struct.unpack('<II',data(0x1006248b0+(identifier-194)*8,8))[1]
def initAssoc(identifier,amount=0,delta=0,time=0,speed=1,duration=.73333335,otherGroup=3):
 global nextIndex
 ptr=0x20001000+nextIndex*0x100;hier=0x20010000+nextIndex*0x100;nextIndex+=1
 uc.mem_write(ptr,bytes(0x100));uc.mem_write(hier,bytes(0x100));uc.mem_write(ptr+0x1a,struct.pack('<h',otherGroup));uc.mem_write(ptr+0x28,struct.pack('<Q',hier));uc.mem_write(ptr+0x30,struct.pack('<ffff',amount,delta,time,speed));uc.mem_write(ptr+0x44,struct.pack('<HH',identifier,flags(identifier)|1));uc.mem_write(hier+0x18,struct.pack('<f',duration));pointers[ptr]=identifier;return ptr
profile={}
def hook(uc,addr,size,unused):
 if addr==0x100138804:
  identifier=uc.reg_read(UC_ARM64_REG_W1);uc.mem_write(static+0xe,struct.pack('<H',flags(identifier)));uc.reg_write(UC_ARM64_REG_X0,static)
 elif addr==0x1001388b4:
  identifier=uc.reg_read(UC_ARM64_REG_W1);ptr=initAssoc(identifier,duration=profile['duration']);created.append(ptr);uc.reg_write(UC_ARM64_REG_X0,ptr)
 elif addr==0x10013cefc:events.append('UncompressAnimation')
 else:return
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
blendHook=uc.hook_add(UC_HOOK_CODE,hook)
def run(request,associations,duration=.6666667,blend=4):
 global pointers,events,created,nextIndex,profile
 pointers={};events=[];created=[];nextIndex=0;profile={'duration':duration};uc.mem_write(clump,bytes(0x20000));uc.mem_write(0x10068acb4,struct.pack('<i',0x70));uc.mem_write(0x100689fa0,struct.pack('<Q',groups));uc.mem_write(clump+0x70,struct.pack('<Q',clumpData));addresses=[initAssoc(**a) for a in associations]
 for i,p in enumerate(addresses):uc.mem_write(p+8,struct.pack('<QQ',addresses[i+1]+8 if i+1<len(addresses) else 0,addresses[i-1]+8 if i else clumpData))
 uc.mem_write(clumpData,struct.pack('<Q',addresses[0]+8 if addresses else 0));uc.reg_write(UC_ARM64_REG_SP,stack);uc.reg_write(UC_ARM64_REG_X0,clump);uc.reg_write(UC_ARM64_REG_W1,group);uc.reg_write(UC_ARM64_REG_W2,request);uc.reg_write(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',blend))[0]);uc.reg_write(UC_ARM64_REG_LR,0x2001e000);uc.emu_start(0x10013d5dc,0x2001e000,count=3000)
 if uc.reg_read(UC_ARM64_REG_PC)!=0x2001e000:raise RuntimeError('Native BlendAnimation did not return.')
 order=[];p=struct.unpack('<Q',uc.mem_read(clumpData,8))[0]
 while p:
  ptr=p-8;order.append({'identifier':pointers[ptr],'new':ptr in created,'amount':struct.unpack('<f',uc.mem_read(ptr+0x30,4))[0],'delta':struct.unpack('<f',uc.mem_read(ptr+0x34,4))[0],'time':struct.unpack('<f',uc.mem_read(ptr+0x38,4))[0],'speed':struct.unpack('<f',uc.mem_read(ptr+0x3c,4))[0],'flags':struct.unpack('<H',uc.mem_read(ptr+0x46,2))[0]});p=struct.unpack('<Q',uc.mem_read(p,8))[0]
  if len(order)>10:raise RuntimeError('Association chain did not terminate.')
 return {'input':{'request':request,'associations':associations,'duration':f(duration),'blend':f(blend)},'returned':pointers[uc.reg_read(UC_ARM64_REG_X0)],'associations':order,'events':events}
uc.hook_del(blendHook)
for page in [0x10013a000,0x10013b000,0x1000fb000,0x10039c000]:uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
uc.mem_map(0x100929000,0x1000)
removed=[];rate=None
originalHook=hook
def frameHook(uc,addr,size,unused):
 global rate
 if addr==0x10013ae84:
  period=struct.unpack('<f',struct.pack('<I',uc.reg_read(UC_ARM64_REG_S9)))[0];rate=1 if period==0 else struct.unpack('<f',struct.pack('<I',uc.reg_read(UC_ARM64_REG_S0)))[0];return
 if addr==0x2001d100:
  p=uc.reg_read(UC_ARM64_REG_X0);n,prev=struct.unpack('<QQ',uc.mem_read(p+8,16));uc.mem_write(prev,struct.pack('<Q',n))
  if n:uc.mem_write(n+8,struct.pack('<Q',prev))
  removed.append(pointers[p]);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR));return
 if addr in [0x10039cc80,0x1000fb878]:
  if addr==0x10039cc80:uc.reg_write(UC_ARM64_REG_X0,0)
  uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR));return
 originalHook(uc,addr,size,unused)
frameHookId=uc.hook_add(UC_HOOK_CODE,frameHook)
def frame(associations,dt=1/60,onScreen=False):
 global pointers,events,created,nextIndex,removed,rate
 pointers={};events=[];created=[];nextIndex=0;removed=[];rate=None;uc.mem_write(clump,bytes(0x20000));uc.mem_write(0x10068acb4,struct.pack('<i',0x70));uc.mem_write(clump+0x70,struct.pack('<Q',clumpData));uc.mem_write(clumpData+0x20,struct.pack('<Q',0x20000500));uc.mem_write(0x20000608,struct.pack('<Q',0x2001d100));addresses=[]
 for row in associations:
  args=row.copy();flagOverride=args.pop('flags',None);step=args.pop('timeStep',0);p=initAssoc(**args);addresses.append(p);uc.mem_write(p,struct.pack('<Q',0x20000600));uc.mem_write(p+0x40,struct.pack('<f',step));hier=struct.unpack('<Q',uc.mem_read(p+0x28,8))[0];uc.mem_write(hier+8,struct.pack('<Q',0x2001c000))
  if flagOverride is not None:uc.mem_write(p+0x46,struct.pack('<H',flagOverride))
 for i,p in enumerate(addresses):uc.mem_write(p+8,struct.pack('<QQ',addresses[i+1]+8 if i+1<len(addresses) else 0,addresses[i-1]+8 if i else clumpData))
 uc.mem_write(clumpData,struct.pack('<Q',addresses[0]+8 if addresses else 0));uc.reg_write(UC_ARM64_REG_SP,stack);uc.reg_write(UC_ARM64_REG_X0,clump);uc.reg_write(UC_ARM64_REG_W1,int(onScreen));uc.reg_write(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',dt))[0]);uc.reg_write(UC_ARM64_REG_LR,0x2001e000);uc.emu_start(0x10013ad30,0x2001e000,count=5000)
 if uc.reg_read(UC_ARM64_REG_PC)!=0x2001e000:raise RuntimeError('Native clump scalar update did not return.')
 out=[];p=struct.unpack('<Q',uc.mem_read(clumpData,8))[0]
 while p:
  a=p-8;amount,delta,time,speed,step=struct.unpack('<5f',uc.mem_read(a+0x30,20));out.append({'identifier':pointers[a],'amount':amount,'delta':delta,'time':time,'speed':speed,'timeStep':step,'flags':struct.unpack('<H',uc.mem_read(a+0x46,2))[0]});p=struct.unpack('<Q',uc.mem_read(p,8))[0]
  if len(out)>10:raise RuntimeError('Frame list failed to terminate.')
 return {'input':{'associations':associations,'dt':f(dt),'onScreen':onScreen},'associations':out,'removed':removed.copy(),'rate':rate}
uc.hook_del(frameHookId)
for page in [0x100459000,0x10045a000,0x100457000,0x10058c000,0x100590000,0x100594000,0x100595000]:uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
uc.mem_map(0x1007c4000,0x1000)
controllerInput={};fallbackCalls=0
def controllerHook(uc,addr,size,unused):
 global fallbackCalls
 if addr in [0x100459db0,0x10045a0f4]:uc.emu_stop();return
 if addr==0x100457674:
  fallbackCalls+=1;uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR));return
 if addr==0x1001388b4:
  identifier=uc.reg_read(UC_ARM64_REG_W1);profile['duration']=.6666667 if controllerInput['model']==510 and identifier==207 else .8 if controllerInput['model']==510 else .73333335 if identifier==207 else .6666667
  originalHook(uc,addr,size,unused);p=uc.reg_read(UC_ARM64_REG_X0);hier=struct.unpack('<Q',uc.mem_read(p+0x28,8))[0];uc.mem_write(hier+8,struct.pack('<Q',0x2001c000));return
 frameHook(uc,addr,size,unused)
uc.hook_add(UC_HOOK_CODE,controllerHook)
def snapshot():
 out=[];p=struct.unpack('<Q',uc.mem_read(clumpData,8))[0]
 while p:
  a=p-8;amount,delta,time,speed,step=struct.unpack('<5f',uc.mem_read(a+0x30,20));out.append({'identifier':pointers[a],'amount':amount,'delta':delta,'time':time,'speed':speed,'timeStep':step,'flags':struct.unpack('<H',uc.mem_read(a+0x46,2))[0]});p=struct.unpack('<Q',uc.mem_read(p,8))[0]
  if len(out)>10:raise RuntimeError('Controller list failed to terminate.')
 return out

def control(associations,model=481,speed=.2,coefficient=4.9,gas=1,lean=0,driveBy=False,dt=1/60,gear=1,maxFlatVelocity=.50777864,leanFwd=0,status=0):
 global pointers,events,created,nextIndex,removed,rate,controllerInput,fallbackCalls
 pointers={};events=[];created=[];nextIndex=0;removed=[];rate=None;fallbackCalls=0;controllerInput={'model':model};uc.mem_write(clump,bytes(0x20000));uc.mem_write(0x10068acb4,struct.pack('<i',0x70));uc.mem_write(0x100689fa0,struct.pack('<Q',groups));uc.mem_write(clump+0x70,struct.pack('<Q',clumpData));uc.mem_write(clumpData+0x20,struct.pack('<Q',0x20000500));uc.mem_write(0x20000608,struct.pack('<Q',0x2001d100));addresses=[]
 for row in associations:
  args=row.copy();flagOverride=args.pop('flags',None);step=args.pop('timeStep',0);args.setdefault('duration',.6666667 if model==510 and row['identifier']==207 else .8 if model==510 else .73333335 if row['identifier']==207 else .6666667);p=initAssoc(**args);addresses.append(p);uc.mem_write(p,struct.pack('<Q',0x20000600));uc.mem_write(p+0x40,struct.pack('<f',step));hier=struct.unpack('<Q',uc.mem_read(p+0x28,8))[0];uc.mem_write(hier+8,struct.pack('<Q',0x2001c000))
  if flagOverride is not None:uc.mem_write(p+0x46,struct.pack('<H',flagOverride))
 for i,p in enumerate(addresses):uc.mem_write(p+8,struct.pack('<QQ',addresses[i+1]+8 if i+1<len(addresses) else 0,addresses[i-1]+8 if i else clumpData))
 uc.mem_write(clumpData,struct.pack('<Q',addresses[0]+8 if addresses else 0))
 uc.mem_write(0x1007c44a0,struct.pack('<f',dt*50))
 bike,handling,ped=0x20014000,0x20016000,0x20017000
 uc.mem_write(bike+0x32,struct.pack('<H',model));uc.mem_write(bike+0x628,bytes([gear]));uc.mem_write(bike+0x4a8,struct.pack('<Q',handling));uc.mem_write(handling+0x88,struct.pack('<f',maxFlatVelocity));uc.mem_write(bike+0xa1c,struct.pack('<f',coefficient));uc.mem_write(bike+0x838,struct.pack('<f',lean));uc.mem_write(bike+0x840,struct.pack('<f',leanFwd));uc.mem_write(bike+0x5a,bytes([status<<3]));uc.mem_write(bike+0x608,struct.pack('<f',gas));uc.mem_write(bike+0x830,struct.pack('<I',group));uc.mem_write(ped+0x20,struct.pack('<Q',clump));uc.reg_write(UC_ARM64_REG_X19,bike);uc.reg_write(UC_ARM64_REG_X20,ped);uc.reg_write(UC_ARM64_REG_X25,next((p for p in addresses if pointers[p]==207),0));uc.reg_write(UC_ARM64_REG_X24,next((p for p in addresses if pointers[p]==208),0));uc.reg_write(UC_ARM64_REG_X23,0);uc.reg_write(UC_ARM64_REG_X22,0);uc.reg_write(UC_ARM64_REG_X21,0);uc.reg_write(UC_ARM64_REG_X26,0x2001b000 if driveBy else 0)
 for reg,value in [(UC_ARM64_REG_S8,speed),(UC_ARM64_REG_S9,0),(UC_ARM64_REG_S10,0),(UC_ARM64_REG_S13,1),(UC_ARM64_REG_S11,0),(UC_ARM64_REG_S12,0)]:uc.reg_write(reg,struct.unpack('<I',struct.pack('<f',value))[0])
 uc.reg_write(UC_ARM64_REG_SP,stack);uc.emu_start(0x100459cb0,0x10045a2e0,count=5000)
 if uc.reg_read(UC_ARM64_REG_PC) not in [0x100459db0,0x10045a0f4]:raise RuntimeError('CBmx controller did not reach phase continuation.')
 before=snapshot();crank=None if uc.reg_read(UC_ARM64_REG_PC)==0x100459db0 else struct.unpack('<f',uc.mem_read(bike+0xa24,4))[0]
 uc.reg_write(UC_ARM64_REG_X0,clump);uc.reg_write(UC_ARM64_REG_W1,0);uc.reg_write(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',dt))[0]);uc.reg_write(UC_ARM64_REG_LR,0x2001e000);uc.emu_start(0x10013ad30,0x2001e000,count=5000)
 if uc.reg_read(UC_ARM64_REG_PC)!=0x2001e000:raise RuntimeError('Controller frame did not return.')
 return {'input':{'associations':associations,'model':model,'speed':f(speed),'coefficient':f(coefficient),'gas':f(gas),'lean':f(lean),'driveBy':driveBy,'dt':f(dt)},'control':before,'crank':crank,'fallbackCalls':fallbackCalls,'frame':snapshot(),'rate':rate,'removed':removed.copy()}
contexts=[[],[{'identifier':207,'amount':1,'time':.2,'speed':.6}],[{'identifier':208,'amount':1,'time':.3,'speed':.8}],[{'identifier':207,'amount':.5,'delta':-4,'time':.2,'speed':.6},{'identifier':208,'amount':.5,'delta':4,'time':.3,'speed':1}],[{'identifier':208,'amount':.5,'delta':-4,'time':.3,'speed':1},{'identifier':207,'amount':.5,'delta':4,'time':.2,'speed':.6}],[{'identifier':207,'amount':0,'delta':0,'time':.2,'flags':0x1032}]]
rows=[]
for model in [481,509,510]:
 for coefficient in [0,4.9,5.0001,8]:
  for gas in [0,1]:
   for context in contexts:rows.append(control(context,model,coefficient=coefficient,gas=gas))
for speed in [-.1,0,.01,.2,1]:
 for lean in [0,.5,.7]:
  for driveBy in [False,True]:rows.append(control(contexts[3],speed=speed,lean=lean,driveBy=driveBy))
if args.profiles:
 for row in json.loads(args.profiles.read_text()):
  profileInput={**row['input'],'dt':row['dt'],'associations':[{**{k:v for k,v in a.items() if k!='group'},'otherGroup':a.get('group',3)} for a in row['associations']]}
  rows.append(control(**profileInput))
args.output.write_text(json.dumps({'source':'Selected CBmx controller plus actual native BlendAnimation/Sync/SetCurrentTime and scalar clump update; ordinary CBike fallback/zero-node allocation/decompression/frame effects declared stubs','sha256':sha256,'cases':rows},indent=2)+'\n');print(json.dumps({'cases':len(rows)}))
