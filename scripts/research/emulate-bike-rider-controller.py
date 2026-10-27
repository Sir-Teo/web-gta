"""Capture the ordinary CBike rider association/filter stage and scalar clump update.

Actual GetAssociation, BlendAnimation, AddAnimation and SetCurrentTime execute.
Actor type/skill, vehicle fields, neutral contact/pitch/turn state and existing
associations are declared inputs. Asset construction/decompression, allocation
cleanup, frame effects and imported host-libm powf are explicit boundaries.
Stops before skeletal vibration at 0x100457f0c; clump pose-frame count is zero.
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
for page in [0x100459000,0x10045a000,0x100457000,0x10058f000,0x10058c000,0x100590000,0x100594000,0x100595000]:uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
uc.mem_map(0x1007c4000,0x1000)


import ctypes
libm=ctypes.CDLL('libm.so.6');libm.powf.argtypes=[ctypes.c_float,ctypes.c_float];libm.powf.restype=ctypes.c_float
for page in [0x100458000,0x100140000,0x100323000,0x100329000,0x100592000,0x1004ed000]:uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
controller={};powerCalls=[]
def groupFlags(identifier):
 table=0x100624c70 if controller.get('quad') and identifier<=205 else 0x1006248b0
 capturedId,result=struct.unpack('<II',data(table+(identifier-194)*8,8))
 if capturedId!=identifier:raise RuntimeError('Unexpected ride descriptor ID.')
 return result

def fullHook(uc,addr,size,user):
 if addr==0x100138804:
  identifier=uc.reg_read(UC_ARM64_REG_W1);uc.mem_write(static+0xe,struct.pack('<H',groupFlags(identifier)));uc.reg_write(UC_ARM64_REG_X0,static);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR));return

 if addr==0x100457f0c:uc.emu_stop();return
 if addr in [0x1003235a4,0x100329f84,0x1004ed5e0]:
  if addr==0x1003235a4:uc.reg_write(UC_ARM64_REG_W0,int(controller['player']))
  elif addr==0x100329f84:uc.reg_write(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',controller['skill']))[0])
  else:
   a,b=[struct.unpack('<f',struct.pack('<I',uc.reg_read(reg)))[0] for reg in [UC_ARM64_REG_S0,UC_ARM64_REG_S1]];result=libm.powf(a,b);powerCalls.append({'base':a,'exponent':b,'result':result});uc.reg_write(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',result))[0])
  uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR));return
 if addr==0x1001388b4:
  identifier=uc.reg_read(UC_ARM64_REG_W1);ptr=initAssoc(identifier,amount=1,duration=controller['durations'].get(identifier,.1));created.append(ptr);uc.mem_write(ptr+0x46,struct.pack('<H',groupFlags(identifier)|1));uc.mem_write(ptr,struct.pack('<Q',0x20000600));hier=struct.unpack('<Q',uc.mem_read(ptr+0x28,8))[0];uc.mem_write(hier+8,struct.pack('<Q',0x2001c000));uc.reg_write(UC_ARM64_REG_X0,ptr);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR));return
 frameHook(uc,addr,size,user)
uc.hook_add(UC_HOOK_CODE,fullHook)
from unicorn import UC_HOOK_MEM_INVALID
def fault(uc,access,addr,size,value,user):
 print('fault',hex(uc.reg_read(UC_ARM64_REG_PC)),hex(addr))
 return False
uc.hook_add(UC_HOOK_MEM_INVALID,fault)
def full(speed=0,lean=0,player=True,skill=0,gas=0,dt=1/60,associations=None,passenger=False,brake=0,leanFwd=0,previousLean=0,previousForward=0,fullAnimLean=.75,maxFlatVelocity=.5,maxReverseVelocity=-.1,durations=None,timeStep=None,unclippedTimeStep=None,quad=False):
 global pointers,nextIndex,created,controller,powerCalls,events,removed,rate
 pointers={};nextIndex=0;created=[];powerCalls=[];events=[];removed=[];rate=None;controller={'player':player,'skill':skill,'quad':quad,'durations':{194:.033333335,195:.033333335,196:.1,197:.1,198:.1,199:.1,200:.46666667}}
 if durations:controller['durations']={int(k):v for k,v in durations.items()}
 if timeStep is None:timeStep=dt*50
 if unclippedTimeStep is None:unclippedTimeStep=timeStep
 uc.mem_write(clump,bytes(0x20000));uc.mem_write(0x10068acb4,struct.pack('<i',0x70));uc.mem_write(0x100689fa0,struct.pack('<Q',groups));uc.mem_write(clump+0x70,struct.pack('<Q',clumpData));uc.mem_write(clumpData+0x20,struct.pack('<Q',0x20000500));uc.mem_write(0x20000608,struct.pack('<Q',0x2001d100));addresses=[]
 if associations is None:associations=[{'identifier':194,'amount':1,'duration':.033333335}]
 for a in associations:
  values=a.copy();override=values.pop('flags',None);previousStep=values.pop('timeStep',0);p=initAssoc(**values);uc.mem_write(p+0x40,struct.pack('<f',previousStep))
  uc.mem_write(p+0x46,struct.pack('<H',override if override is not None else groupFlags(a['identifier'])|1))
  addresses.append(p);uc.mem_write(p,struct.pack('<Q',0x20000600));hier=struct.unpack('<Q',uc.mem_read(p+0x28,8))[0];uc.mem_write(hier+8,struct.pack('<Q',0x2001c000))
 for i,p in enumerate(addresses):uc.mem_write(p+8,struct.pack('<QQ',addresses[i+1]+8 if i+1<len(addresses) else 0,addresses[i-1]+8 if i else clumpData))
 uc.mem_write(clumpData,struct.pack('<Q',addresses[0]+8 if addresses else 0))
 initial=[]
 for p in addresses:
  amount,delta,time,playback,step=struct.unpack('<5f',uc.mem_read(p+0x30,20));hier=struct.unpack('<Q',uc.mem_read(p+0x28,8))[0];initial.append({'identifier':pointers[p],'amount':amount,'delta':delta,'time':time,'speed':playback,'timeStep':step,'flags':struct.unpack('<H',uc.mem_read(p+0x46,2))[0],'duration':struct.unpack('<f',uc.mem_read(hier+0x18,4))[0]})
 bike,ped,ride,handling,matrix=0x20014000,0x20016000,0x20017000,0x20018000,0x20019000
 uc.mem_write(bike+0x18,struct.pack('<Q',matrix));uc.mem_write(matrix,struct.pack('<4f',0,-1,0,0));uc.mem_write(matrix+0x10,struct.pack('<4f',1,0,0,0));uc.mem_write(matrix+0x20,struct.pack('<4f',0,0,1,0));uc.mem_write(bike+0x734,struct.pack('<I',0 if quad else 9));uc.mem_write(bike+0x4a8,struct.pack('<Q',handling));uc.mem_write(bike+0x5a0,struct.pack('<Q',ped));uc.mem_write(bike+0x5a8,struct.pack('<Q',0x2001b000 if passenger else 0));uc.mem_write(bike+0x68,struct.pack('<3f',speed,0,0));uc.mem_write(bike+0x608,struct.pack('<ff',gas,brake));uc.mem_write(handling+0x88,struct.pack('<ff',maxFlatVelocity,maxReverseVelocity));uc.mem_write(handling+0x18,struct.pack('<f',fullAnimLean));uc.mem_write(ped+0x20,struct.pack('<Q',clump));uc.mem_write(ped+0x5a8,struct.pack('<Q',bike));uc.mem_write(ride,struct.pack('<I',3));uc.mem_write(ride+8,struct.pack('<f',lean));uc.mem_write(ride+0x10,struct.pack('<3f',leanFwd,previousLean,previousForward));uc.mem_write(0x1007c44a0,struct.pack('<ff',timeStep,unclippedTimeStep));uc.reg_write(UC_ARM64_REG_SP,stack)
 for reg,value in [(UC_ARM64_REG_X0,ped),(UC_ARM64_REG_X1,bike),(UC_ARM64_REG_X2,ride),(UC_ARM64_REG_X3,handling),(UC_ARM64_REG_W4,0),(UC_ARM64_REG_LR,0x2001e000)]:uc.reg_write(reg,value)
 uc.emu_start(0x100457674,0x2001e000,count=20000)
 if uc.reg_read(UC_ARM64_REG_PC)!=0x100457f0c:raise RuntimeError('Ordinary rider did not reach the pose continuation.')
 capturedInput={'speed':f(speed),'lean':f(lean),'player':player,'skill':f(skill),'gas':f(gas),'dt':f(dt),'timeStep':f(timeStep),'unclippedTimeStep':f(unclippedTimeStep),'fullAnimLean':f(fullAnimLean),'maxFlatVelocity':f(maxFlatVelocity),'maxReverseVelocity':f(maxReverseVelocity),'durations':controller['durations'],'associations':initial,'quad':quad,'passenger':passenger,'brake':f(brake),'leanFwd':f(leanFwd),'previousLean':f(previousLean),'previousForward':f(previousForward)};out=[];p=struct.unpack('<Q',uc.mem_read(clumpData,8))[0]
 while p:
  a=p-8;amount,delta,time,speed,step=struct.unpack('<5f',uc.mem_read(a+0x30,20));out.append({'identifier':pointers[a],'amount':amount,'delta':delta,'time':time,'speed':speed,'timeStep':step,'flags':struct.unpack('<H',uc.mem_read(a+0x46,2))[0]});p=struct.unpack('<Q',uc.mem_read(p,8))[0]
 filtered=list(struct.unpack('<2f',uc.mem_read(ride+0x14,8)));before=out
 uc.reg_write(UC_ARM64_REG_SP,stack);uc.reg_write(UC_ARM64_REG_X0,clump);uc.reg_write(UC_ARM64_REG_W1,0);uc.reg_write(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',dt))[0]);uc.reg_write(UC_ARM64_REG_LR,0x2001e000);uc.emu_start(0x10013ad30,0x2001e000,count=10000)
 if uc.reg_read(UC_ARM64_REG_PC)!=0x2001e000:raise RuntimeError('Ordinary rider clump update did not return.')
 out=[];p=struct.unpack('<Q',uc.mem_read(clumpData,8))[0]
 while p:
  a=p-8;amount,delta,time,speed,step=struct.unpack('<5f',uc.mem_read(a+0x30,20));out.append({'identifier':pointers[a],'amount':amount,'delta':delta,'time':time,'speed':speed,'timeStep':step,'flags':struct.unpack('<H',uc.mem_read(a+0x46,2))[0]});p=struct.unpack('<Q',uc.mem_read(p,8))[0]
 return {'input':capturedInput,'associations':before,'frame':out,'rate':rate,'removed':removed.copy(),'filtered':filtered,'powerCalls':powerCalls.copy(),'events':events.copy()}
rows=[full(speed,lean,player,gas=gas,passenger=passenger) for speed in [-.3,-.2,-.15,-.05,-.02,-.01,0,.01,.01999999,.02,.02000001,.05,.1,.3,.6] for lean in [-.4,0,.4] for player in [False,True] for gas in [-1,0,1] for passenger in [False,True]]
for brake in [0,.5,.50000006,1]:
 for speed in [0,.01,.010000001,.1,.3]:
  for lean in [-.6,0,.6]:rows.append(full(speed,lean,True,gas=1,brake=brake))
for leanFwd in [-1,-.3,0,.3,1]:
 for previousLean in [-.8,0,.8]:
  for previousForward in [-.8,0,.8]:rows.append(full(.1,.2,True,gas=1,leanFwd=leanFwd,previousLean=previousLean,previousForward=previousForward))

contexts=[
 [{'identifier':195,'amount':1,'time':.033333335,'duration':.033333335},{'identifier':194,'amount':1,'duration':.033333335}],
 [{'identifier':195,'amount':.4,'delta':-4,'time':.033333335,'duration':.033333335},{'identifier':197,'amount':.6,'time':.03,'duration':.1,'flags':0x1010},{'identifier':194,'amount':1,'duration':.033333335}],
 [{'identifier':200,'amount':1,'time':.2,'duration':.46666667},{'identifier':194,'amount':1,'duration':.033333335}],
 [{'identifier':202,'amount':.5,'delta':4,'time':.02,'duration':.033333335},{'identifier':196,'amount':.5,'time':.02,'duration':.1,'flags':0x1010},{'identifier':194,'amount':1,'duration':.033333335}],
 [{'identifier':208,'amount':.6,'delta':-8,'time':.3,'duration':.6666667,'flags':0x1032},{'identifier':207,'amount':.4,'delta':-8,'time':.2,'speed':.6,'flags':0x1032},{'identifier':194,'amount':1,'duration':.033333335}],
 [{'identifier':199,'amount':.2,'time':.01,'duration':.1,'flags':0x1010},{'identifier':198,'amount':.2,'time':.01,'duration':.1,'flags':0x1010},{'identifier':197,'amount':.3,'time':.01,'duration':.1,'flags':0x1010},{'identifier':196,'amount':.3,'time':.01,'duration':.1,'flags':0x1010},{'identifier':194,'amount':1,'duration':.033333335}],
]
for context in contexts:
 for speed in [-.05,0,.1]:
  for gas in [-1,1]:
   for player in [False,True]:rows.append(full(speed,.2,player,gas=gas,associations=context))
 for dt in [0,1/30,.1,.5]:rows.append(full(.1,.2,True,gas=1,dt=dt,associations=context))
for dt in [0,1/60,.5,1]:
 for amount in [0,.5,1]:
  context=[{'identifier':200,'amount':amount,'time':.2,'duration':.46666667},{'identifier':194,'amount':1,'duration':.033333335}]
  rows.append(full(-.05,.1,True,gas=-1,dt=dt,associations=context,quad=True))
for dt in [1/60,1]:rows.append(full(-.05,.1,True,gas=-1,dt=dt,quad=True))
if args.profiles:
 for row in json.loads(args.profiles.read_text()):rows.append(full(**row['nativeInput']))
args.output.write_text(json.dumps({'source':'Actual ordinary CBike association/filter stage and native scalar clump update; declared actor type/skill and neutral contact/pitch/turn inputs; external scalar asset construction, decompression, allocation/frame effects and host-libm powf boundaries','entry':'0x100457674','poseStop':'0x100457f0c','sha256':sha256,'cases':rows},indent=2)+'\n');print(json.dumps({'cases':len(rows)}))
