"""Capture car drive-by and driving association writes plus the scalar clump.

Actual DoDriveByShootings (null ride data), ProcessDrivingAnims, association
lookup/blend and clump execute. Player/pad/weapon services, driving stat and
asset/clump construction are declared external. Native PED descriptors and
ride ID tables are read from the pinned binary. Full-body idle task ownership,
skeletal callbacks remain outside the capture. With nativeWeapon input enabled,
actual owner-null CWeapon::Update/FireFromCar execute; instant-hit effects, audio,
completion percentage and reload-time services are declared external.
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
pointers={};events=[];created=[];group=0;nextIndex=0
def f(x):return struct.unpack('<f',struct.pack('<f',x))[0]
pedFlags=dict(struct.unpack('<II',data(0x100624418+i*8,8)) for i in range(131))
def flags(identifier):return pedFlags[identifier]
def initAssoc(identifier,amount=0,delta=0,time=0,speed=1,duration=.73333335,otherGroup=0):
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
def groupFlags(identifier):return flags(identifier)

def fullHook(uc,addr,size,user):
 if addr==0x100138804:
  identifier=uc.reg_read(UC_ARM64_REG_W1);uc.mem_write(static+0xe,struct.pack('<H',groupFlags(identifier)));uc.reg_write(UC_ARM64_REG_X0,static);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR));return

 if addr==0x100457f0c:uc.reg_write(UC_ARM64_REG_PC,0x100457fa4);return
 if addr in [0x10045a134,0x10045a214]:uc.emu_stop();return
 if addr in [0x1003235a4,0x100329f84,0x1004ed5e0]:
  if addr==0x1003235a4:uc.reg_write(UC_ARM64_REG_W0,int(controller['player']))
  elif addr==0x100329f84:uc.reg_write(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',controller['skill']))[0])
  else:
   a,b=[struct.unpack('<f',struct.pack('<I',uc.reg_read(reg)))[0] for reg in [UC_ARM64_REG_S0,UC_ARM64_REG_S1]];result=libm.powf(a,b);powerCalls.append({'base':a,'exponent':b,'result':result});uc.reg_write(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',result))[0])
  uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR));return
 if addr==0x1001388b4:
  identifier=uc.reg_read(UC_ARM64_REG_W1);ptr=initAssoc(identifier,amount=1,duration=controller['durations'].get(identifier,.1));created.append(ptr);uc.mem_write(ptr+0x46,struct.pack('<H',groupFlags(identifier)|1));uc.mem_write(ptr,struct.pack('<Q',0x20000600));hier=struct.unpack('<Q',uc.mem_read(ptr+0x28,8))[0];uc.mem_write(hier+8,struct.pack('<Q',0x2001c000));uc.reg_write(UC_ARM64_REG_X0,ptr);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR));return
 frameHook(uc,addr,size,user)

from unicorn import UC_HOOK_MEM_INVALID
def fault(uc,access,addr,size,value,user):
 print('fault',hex(uc.reg_read(UC_ARM64_REG_PC)),hex(addr))
 return False
uc.hook_add(UC_HOOK_MEM_INVALID,fault)
for page in [0x10049b000,0x10049d000,0x10049a000,0x100497000,0x100365000,0x10035f000,0x100243000,0x100244000]:
 uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
uc.mem_map(0x1007a3000,0x1000)
uc.mem_map(0x100480000,0x1000);uc.mem_write(0x100480000,data(0x100480000,0x1000));uc.mem_map(0x100654000,0x1000);uc.mem_write(0x100654000,data(0x100654000,0x1000));uc.mem_map(0x1008f8000,0x1000);uc.mem_map(0x100260000,0x1000)
for page in [0x10014f000,0x100256000,0x100261000,0x100284000,0x10071d000]:uc.mem_map(page,0x1000)
drive={};fireAttempts=[];usedRide=[];fireResults=[];weaponUpdated=None;animationReady=False
vehicle,ped,pad,weaponInfo,playerInfo,ride=0x20014000,0x20016000,0x20018000,0x20019000,0x2001a000,0x20014830
def driveHook(uc,addr,size,user):
 global weaponUpdated,animationReady
 if addr==0x10049b96c:animationReady=True
 if addr==0x10049b784:weaponUpdated=weaponSnapshot()
 if addr==0x10049b9a0:fireResults.append(bool(uc.reg_read(UC_ARM64_REG_W0)))
 if drive.get('nativeWeapon'):
  if addr==0x100497908:fireAttempts.append([uc.reg_read(UC_ARM64_REG_W2),uc.reg_read(UC_ARM64_REG_W3)])
  if addr in [0x100497a48,0x10014fb70,0x100256130,0x100261c30,0x10049dbf8,0x100284944]:
   value=1 if addr==0x100497a48 else drive['reloadMs'] if addr==0x10049dbf8 else 0
   if addr==0x100261c30:uc.reg_write(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',drive['progress']))[0])
   uc.reg_write(UC_ARM64_REG_X0,value);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR));return
 if addr==0x1004805f4:usedRide.append(list(struct.unpack('<4I',uc.mem_read(uc.reg_read(UC_ARM64_REG_X25),16))))
 if addr==0x100260858:uc.reg_write(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',drive['drivingSkill']))[0]);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR));return
 if addr==0x2001d200:uc.reg_write(UC_ARM64_REG_X0,0);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR));return
 if addr in [0x10036547c,0x10035f8e4,0x10049db10,0x1002437fc,0x10049adf8,0x100244504,0x10024460c,0x100497908,0x100329d10] and not (drive.get('nativeWeapon') and addr in [0x10049adf8,0x100497908]):
  value=0
  if addr==0x10036547c:value=playerInfo if drive['playerData'] else 0
  elif addr==0x10035f8e4:value=pad if drive['pad'] else 0
  elif addr==0x10049db10:value=weaponInfo
  elif addr==0x1002437fc:value=drive['fire']
  elif addr==0x100244504:value=int(drive['left'])
  elif addr==0x10024460c:value=int(drive['right'])
  elif addr==0x100497908:fireAttempts.append([uc.reg_read(UC_ARM64_REG_W2),uc.reg_read(UC_ARM64_REG_W3)]);value=1
  uc.reg_write(UC_ARM64_REG_X0,value);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR));return
 fullHook(uc,addr,size,user)
uc.hook_add(UC_HOOK_CODE,driveHook)
def weaponSnapshot():
 state,clip,total,nextShot=struct.unpack('<4I',uc.mem_read(ped+0x734,16));return {'state':state,'clip':clip,'total':total,'nextShot':nextShot}
def capture(nativeWeapon=False,state=0,clip=30,magazine=30,reloadMs=1000,infinite=False,progress=0,entityByte=2,low=False,steer=0,gas=0,drivingSkill=0,velocity=[0,0,0],boat=False,sitInBoat=False,kart=False,truck=False,offscreen=False,player=True,blendRadio=False,cameraMode=0,cameraDirection=0,driving=True,withDriveBy=True,fire=0,left=False,right=False,ammo=100,subtype=0,associations=None,driver=True,playerData=True,pad=True,allowed=True,slot=4,dt=1/60,timeMs=100,nextShot=0,durations=None,rider=None):
 global pointers,nextIndex,created,controller,powerCalls,events,removed,rate,drive,weaponUpdated,animationReady
 drive={'nativeWeapon':nativeWeapon,'reloadMs':reloadMs,'progress':progress,'drivingSkill':drivingSkill,'fire':fire,'left':left,'right':right,'playerData':playerData,'pad':pad};fireAttempts.clear();fireResults.clear();weaponUpdated=None;animationReady=False;usedRide.clear();pointers={};nextIndex=0;created=[];powerCalls=[];events=[];removed=[];rate=None
 controller={'quad':bool(rider and rider.get('quad')),'player':player,'skill':0,'durations':{**{i:.2 for i in range(60,99)},189:1.0}}
 if durations:controller['durations'].update({int(k):v for k,v in durations.items()})
 uc.mem_write(clump,bytes(0x20000));uc.mem_write(0x10068acb4,struct.pack('<i',0x70));uc.mem_write(0x100689fa0,struct.pack('<Q',groups));uc.mem_write(clump+0x70,struct.pack('<Q',clumpData));uc.mem_write(clumpData+0x20,struct.pack('<Q',0x20000500));uc.mem_write(0x20000608,struct.pack('<Q',0x2001d100));uc.mem_write(0x20000780,struct.pack('<Q',0x2001d200));addresses=[]
 if associations is None:associations=[{'identifier':60,'amount':1,'duration':.2}]
 for a in associations:
  values=a.copy();override=values.pop('flags',None);previousStep=values.pop('timeStep',0);p=initAssoc(**values);uc.mem_write(p+0x40,struct.pack('<f',previousStep));uc.mem_write(p+0x46,struct.pack('<H',override if override is not None else groupFlags(a['identifier'])|1));addresses.append(p);uc.mem_write(p,struct.pack('<Q',0x20000600));hier=struct.unpack('<Q',uc.mem_read(p+0x28,8))[0];uc.mem_write(hier+8,struct.pack('<Q',0x2001c000))
 for i,p in enumerate(addresses):uc.mem_write(p+8,struct.pack('<QQ',addresses[i+1]+8 if i+1<len(addresses) else 0,addresses[i-1]+8 if i else clumpData))
 uc.mem_write(clumpData,struct.pack('<Q',addresses[0]+8 if addresses else 0))
 def snapshot(duration=False):
  out=[];p=struct.unpack('<Q',uc.mem_read(clumpData,8))[0]
  while p:
   a=p-8;amount,delta,time,speed,step=struct.unpack('<5f',uc.mem_read(a+0x30,20));row={'identifier':pointers[a],'amount':amount,'delta':delta,'time':time,'speed':speed,'timeStep':step,'flags':struct.unpack('<H',uc.mem_read(a+0x46,2))[0]}
   if duration:
    hier=struct.unpack('<Q',uc.mem_read(a+0x28,8))[0];row['duration']=struct.unpack('<f',uc.mem_read(hier+0x18,4))[0]
   out.append(row);p=struct.unpack('<Q',uc.mem_read(p,8))[0]
  return out
 initial=snapshot(True)
 uc.mem_write(vehicle,struct.pack('<Q',0x20000600));uc.mem_write(vehicle+0x5a0,struct.pack('<Q',ped if driver else 0));uc.mem_write(vehicle+0x738,struct.pack('<I',subtype));uc.mem_write(ride,struct.pack('<I',3));uc.mem_write(ped+0x20,struct.pack('<Q',clump));uc.mem_write(ped+0x730,struct.pack('<5I',28,state,clip,ammo,nextShot));uc.mem_write(playerInfo+0x18f,bytes([int(allowed)]));uc.mem_write(weaponInfo+0x14,struct.pack('<I',slot));uc.mem_write(weaponInfo+0x20,struct.pack('<h',magazine));uc.mem_write(0x1007a3dd5,b'\x01');uc.mem_write(0x1007c4478,struct.pack('<I',timeMs));uc.mem_write(vehicle+0x568,struct.pack('<I',(1<<11) if low else 0));uc.mem_write(vehicle+0x2a,bytes([2 if offscreen else 0]));uc.mem_write(vehicle+0x734,struct.pack('<I',5 if boat else 0));uc.mem_write(vehicle+0x4a8,struct.pack('<Q',0x2001b000));uc.mem_write(0x2001b0cd,bytes([4 if sitInBoat else 0]));uc.mem_write(0x1008f80c8,struct.pack('<I',(4 if kart else 0)|(8 if truck else 0)));uc.mem_write(vehicle+0x68,struct.pack('<3f',*velocity));uc.mem_write(vehicle+0x600,struct.pack('<f',steer));uc.mem_write(vehicle+0x608,struct.pack('<f',gas));uc.mem_write(0x1007a3f26,struct.pack('<H',cameraMode));uc.mem_write(0x1007a3f38,struct.pack('<I',cameraDirection));uc.mem_write(vehicle+0x5a,bytes([entityByte]));uc.mem_write(0x10071d7d8,bytes([int(infinite)]));uc.mem_write(weaponInfo,struct.pack('<I',1 if nativeWeapon else 0))
 if rider:
  handling,engine,matrix=0x2001b100,0x2001b000,0x2001b200
  uc.mem_write(vehicle+0x18,struct.pack('<Q',matrix));uc.mem_write(matrix,struct.pack('<4f',0,-1,0,0));uc.mem_write(matrix+0x10,struct.pack('<4f',1,0,0,0));uc.mem_write(matrix+0x20,struct.pack('<4f',0,0,1,0));uc.mem_write(vehicle+0x734,struct.pack('<I',0 if rider.get('quad') else 9));uc.mem_write(vehicle+0x4a8,struct.pack('<Q',engine));uc.mem_write(vehicle+0x828,struct.pack('<Q',handling));uc.mem_write(handling+0x18,struct.pack('<f',rider['fullAnimLean']));uc.mem_write(engine+0x88,struct.pack('<ff',rider['maxFlatVelocity'],rider['maxReverseVelocity']));uc.mem_write(vehicle+0x68,struct.pack('<3f',rider['speed'],0,0));uc.mem_write(vehicle+0x608,struct.pack('<ff',rider['gas'],rider['brake']));uc.mem_write(vehicle+0x5a8,struct.pack('<Q',0x2001b300 if rider['passenger'] else 0));uc.mem_write(ped+0x5a8,struct.pack('<Q',vehicle));uc.mem_write(ride+8,struct.pack('<f',rider['lean']));uc.mem_write(ride+0x10,struct.pack('<3f',rider['leanFwd'],rider['previousLean'],rider['previousForward']));uc.mem_write(0x1007c44a0,struct.pack('<ff',rider['timeStep'],rider['unclippedTimeStep']))
  uc.mem_write(vehicle+0x32,struct.pack('<H',rider.get('model',481)));uc.mem_write(vehicle+0x5a,bytes([rider.get('status',0)<<3]));uc.mem_write(vehicle+0x628,bytes([rider.get('gear',1)]));uc.mem_write(vehicle+0xa1c,struct.pack('<f',rider.get('coefficient',0)));uc.mem_write(vehicle+0xa24,struct.pack('<f',rider.get('crank',0)))
 uc.reg_write(UC_ARM64_REG_SP,stack);uc.reg_write(UC_ARM64_REG_X0,vehicle);uc.reg_write(UC_ARM64_REG_LR,0x2001e000);uc.emu_start(0x10049b674,0x2001e000,count=20000) if withDriveBy else None
 if withDriveBy and uc.reg_read(UC_ARM64_REG_PC)!=0x2001e000:raise RuntimeError('Drive-by did not return.')
 control=snapshot();riderResult={}
 if driving:
  uc.reg_write(UC_ARM64_REG_SP,stack);uc.reg_write(UC_ARM64_REG_X0,vehicle);uc.reg_write(UC_ARM64_REG_X1,ped);uc.reg_write(UC_ARM64_REG_W2,int(blendRadio));uc.reg_write(UC_ARM64_REG_LR,0x2001e000);uc.emu_start(0x100480498,0x2001e000,count=20000)
  if uc.reg_read(UC_ARM64_REG_PC)!=0x2001e000:raise RuntimeError('Driving did not return.')
 drivingControl=snapshot()
 if rider:
  uc.reg_write(UC_ARM64_REG_SP,stack);uc.reg_write(UC_ARM64_REG_X0,vehicle if subtype==10 else ped);uc.reg_write(UC_ARM64_REG_X1,ped if subtype==10 else vehicle);uc.reg_write(UC_ARM64_REG_X2,ride);uc.reg_write(UC_ARM64_REG_X3,handling);uc.reg_write(UC_ARM64_REG_W4,0);uc.reg_write(UC_ARM64_REG_LR,0x2001e000);uc.emu_start(0x100459b78 if subtype==10 else 0x100457674,0x2001e000,count=20000)
  if uc.reg_read(UC_ARM64_REG_PC) not in [0x2001e000,0x10045a134,0x10045a214]:raise RuntimeError('Rider continuation did not return/stop.')
  riderResult={'riderControl':snapshot(),'filtered':list(struct.unpack('<2f',uc.mem_read(ride+0x14,8))),'crank':struct.unpack('<f',uc.mem_read(vehicle+0xa24,4))[0] if subtype==10 else None}
 shotAt=struct.unpack('<I',uc.mem_read(ped+0x740,4))[0]
 uc.reg_write(UC_ARM64_REG_SP,stack);uc.reg_write(UC_ARM64_REG_X0,clump);uc.reg_write(UC_ARM64_REG_W1,0);uc.reg_write(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',dt))[0]);uc.reg_write(UC_ARM64_REG_LR,0x2001e000);uc.emu_start(0x10013ad30,0x2001e000,count=10000)
 if uc.reg_read(UC_ARM64_REG_PC)!=0x2001e000:raise RuntimeError('Clump did not return.')
 return {'animationReady':animationReady,'weaponUpdated':weaponUpdated,'weapon':weaponSnapshot(),'fireResults':fireResults.copy(),'drivingControl':drivingControl,'usedRide':usedRide.copy(),'input':{'nativeWeapon':nativeWeapon,'state':state,'clip':clip,'magazine':magazine,'reloadMs':reloadMs,'infinite':infinite,'progress':progress,'entityByte':entityByte,'low':low,'steer':steer,'gas':gas,'drivingSkill':drivingSkill,'velocity':velocity,'boat':boat,'sitInBoat':sitInBoat,'kart':kart,'truck':truck,'offscreen':offscreen,'player':player,'blendRadio':blendRadio,'cameraMode':cameraMode,'cameraDirection':cameraDirection,'driving':driving,'withDriveBy':withDriveBy,'fire':fire,'left':left,'right':right,'ammo':ammo,'subtype':subtype,'driver':driver,'playerData':playerData,'pad':pad,'allowed':allowed,'slot':slot,'dt':f(dt),'timeMs':timeMs,'nextShot':nextShot,'associations':initial,'durations':controller['durations']},'control':control,'frame':snapshot(),'rate':rate,'removed':removed.copy(),'fireAttempts':fireAttempts.copy(),'nextShot':shotAt,**riderResult}
base={'identifier':60,'amount':1,'duration':.2}
rows=[]
for low in [False,True]:
 for fire in [0,1]:
  for left,right in [(False,False),(True,False),(False,True),(True,True)]:
   for context in [[base],[{'identifier':74,'amount':1,'time':.2,'duration':.2,'flags':0x1014},base],[{'identifier':76,'amount':.5,'delta':-8,'time':.2,'duration':.2,'flags':0x1014},base],[{'identifier':66,'amount':.7,'duration':.2},base]]:
    rows.append(capture(low=low,fire=fire,left=left,right=right,steer=.305,gas=-1,associations=context))
for steer in [-.61,-.305,0,.305,.61]:
 for gas in [-1,0]:
  for drivingSkill in [0,49.999,50,100]:
   for speed in [0,.4,.40000004]:rows.append(capture(withDriveBy=False,steer=steer,gas=gas,drivingSkill=drivingSkill,velocity=[speed,0,0]))
for kind in [{},{'low':True},{'boat':True},{'boat':True,'sitInBoat':True},{'kart':True},{'truck':True},{'offscreen':True},{'player':False},{'blendRadio':True}]:rows.append(capture(withDriveBy=False,steer=.3,**kind))
for steer in [-.305,0,.305]:
 for gas in [-1,0]:rows.append(capture(withDriveBy=False,steer=steer,gas=gas,cameraMode=16,cameraDirection=1,associations=[{'identifier':78,'amount':.7,'time':.1,'duration':.2},base]))
rows.append(capture(withDriveBy=False,steer=.3,associations=[{'identifier':189,'amount':.4,'time':.1,'duration':1,'flags':29},base]))
for state in range(5):
 for clip,ammo in [(0,100),(1,1),(1,100),(30,100)]:
  for now in [99,100,101]:rows.append(capture(nativeWeapon=True,state=state,clip=clip,ammo=ammo,magazine=50,timeMs=now,nextShot=100,fire=1,left=True,associations=[{'identifier':74,'amount':1,'time':.2,'duration':.2,'flags':0x1014},base]))
if args.profiles:
 for row in json.loads(args.profiles.read_text()):rows.append(capture(**row['nativeInput']))
args.output.write_text(json.dumps({'source':'Actual DoDriveByShootings with null ride data, ProcessDrivingAnims and scalar clump; nativeWeapon profiles also execute owner-null CWeapon::Update/FireFromCar. Player/pad/stat/info/reload/effects/audio and asset construction are external. Native descriptor/ride tables, selection, pose writes and clump arithmetic execute.','sha256':sha256,'driveEntry':'0x100480498','weaponUpdate':'0x10049adf8','weaponFire':'0x100497908','cases':rows},indent=2)+'\n');print(json.dumps({'cases':len(rows)}))
