"""Capture arrest-task subtask choices from the pinned, user-supplied arm64 executable.
Usage: PYTHONPATH=/path/to/unicorn python3 scripts/research/native-arrest-task.py /path/to/executable
Requires unicorn==2.1.4. Task allocations/constructors and weapon queries are intercepted.
This executes the initial/next/control selectors, not the full task graph or any vehicle/ped simulation.
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
SCRATCH=0x200000000;TASK=SCRATCH+0x1000;COP=SCRATCH+0x2000;TARGET=SCRATCH+0x3000;VEHICLE=SCRATCH+0x4000;RESULT=SCRATCH+0x5000
u.mem_map(SCRATCH,0x40000)
constructors={0x1003b1bec:'killPedOnFoot',0x1003d0e08:'dragPedFromCar',0x1003b28a8:'destroyCar',0x1003d0c04:'openDriverDoor'}
SUBTASK=SCRATCH+0x6000;VTABLE=SCRATCH+0x7000;FALL=SCRATCH+0x8000;INTELLIGENCE=SCRATCH+0x9000;GET_TYPE=SCRATCH+0x200;CAN_ABORT=SCRATCH+0x208
case={};choice=None;weapon_events=[];down_times=[]
def x(index):return u.reg_read(UC_ARM64_REG_X0+index)
def w(index):return u.reg_read(UC_ARM64_REG_W0+index)
def hook(uc,addr,size,user):
 global choice
 if addr==SCRATCH:uc.emu_stop();return
 if addr==GET_TYPE:uc.reg_write(UC_ARM64_REG_W0,case['subtask'])
 elif addr==CAN_ABORT:uc.reg_write(UC_ARM64_REG_W0,int(case.get('canAbort',True)))
 elif addr==0x1003e79ac:uc.reg_write(UC_ARM64_REG_W0,int(case.get('driverRoom' if w(1)==10 else 'passengerRoom',True)))
 elif addr==0x10042a860:
  task_type=w(1);choice={'kind':{1100:'arrestPed',907:'seekEntity',1302:'finish',1003:'destroyCar',722:'openDriverDoor',728:'openPassengerDoor',703:'dragPedFromCar',829:'waitUntilOutCar'}.get(task_type,'task-'+str(task_type))};uc.reg_write(UC_ARM64_REG_X0,0 if task_type==1302 else RESULT)
 elif addr==0x10041eb3c:uc.reg_write(UC_ARM64_REG_X0,FALL if w(1)==208 and case.get('hasFall')or w(1)==704 and case.get('leavingCar')else 0)
 elif addr==0x100414960:uc.reg_write(UC_ARM64_REG_W0,int(case.get('falling',False)))
 elif addr==0x10041491c:down_times.append(w(1))
 elif addr==0x1004796c4:uc.reg_write(UC_ARM64_REG_W0,int(case.get('copIsDriver',False)))
 elif addr==0x1003235a4:uc.reg_write(UC_ARM64_REG_W0,int(case.get('player',False)))
 elif addr in constructors:
  choice={'kind':constructors[addr]}
  if choice['kind']=='killPedOnFoot':choice['parameters']=[struct.unpack('<i',struct.pack('<I',w(i)))[0]for i in range(2,7)]
  if choice['kind']=='dragPedFromCar':choice['timeoutMs']=w(2)
 elif addr==0x1003a6ccc:uc.reg_write(UC_ARM64_REG_X0,RESULT)
 elif addr==0x100479678:uc.reg_write(UC_ARM64_REG_W0,int(case.get('upsideDown',False)))
 elif addr==0x100479694:uc.reg_write(UC_ARM64_REG_W0,int(case.get('onSide',False)))
 elif addr==0x10049b5e8:uc.reg_write(UC_ARM64_REG_W0,int(case.get('melee',False)))
 elif addr==0x100329a98:uc.reg_write(UC_ARM64_REG_W0,int(w(1)in case.get('weapons',[])))
 elif addr==0x100323400:weapon_events.append({'give':w(1),'ammo':w(2)})
 elif addr==0x1003298d4:weapon_events.append({'select':w(1)})
 else:
  if not (0x10042abe4<=addr<0x10042ad70 or 0x10042a1e8<=addr<0x10042a794 or 0x10032911c<=addr<0x100329130 or 0x10042add8<=addr<0x10042b3b8):raise RuntimeError('Unhandled native call '+hex(addr))
  return
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
u.hook_add(UC_HOOK_CODE,hook)
cases=[{'name':'missing-target','missing':True},{'name':'on-foot'},{'name':'bike','inVehicle':True,'vehicleClass':9},{'name':'quad','inVehicle':True,'subclass':2},{'name':'upright-car','inVehicle':True},{'name':'overturned-car','inVehicle':True,'upsideDown':True},{'name':'car-on-side','inVehicle':True,'onSide':True},{'name':'boat-armed','inVehicle':True,'subclass':5},{'name':'boat-melee-no-gun','inVehicle':True,'subclass':5,'melee':True},{'name':'boat-melee-has-pistol','inVehicle':True,'subclass':5,'melee':True,'weapons':[22]},{'name':'boat-melee-has-shotgun','inVehicle':True,'subclass':5,'melee':True,'weapons':[25]}]
cases.extend([
 {'name':'kill-next-no-fall','stage':'next','subtask':1000},
 {'name':'kill-next-dead','stage':'next','subtask':1000,'health':0},
 {'name':'kill-next-falling-near','stage':'next','subtask':1000,'hasFall':True,'falling':True,'position':[2,0,0]},
 {'name':'kill-next-horizontal-boundary-height-two','stage':'next','subtask':1000,'hasFall':True,'falling':True,'position':[3,0,2]},
 {'name':'kill-next-outside-horizontal','stage':'next','subtask':1000,'hasFall':True,'falling':True,'position':[3.0001,0,0]},
 {'name':'kill-next-outside-height','stage':'next','subtask':1000,'hasFall':True,'falling':True,'position':[0,0,2.0001]},
 {'name':'kill-next-getting-up','stage':'next','subtask':1000,'hasFall':True,'falling':False},
 {'name':'driver-door-next-succeeded','stage':'next','subtask':722,'inVehicle':True},
 {'name':'driver-door-next-failed','stage':'next','subtask':722,'inVehicle':True,'subtaskFlags':2},
 {'name':'driver-door-next-suspect-left','stage':'next','subtask':722},
 {'name':'passenger-door-next-succeeded','stage':'next','subtask':728,'inVehicle':True},
 {'name':'drag-next-falling-near','stage':'next','subtask':703,'hasFall':True,'falling':True,'position':[3,0,2]},
 {'name':'seek-next-arrived-falling','stage':'next','subtask':907,'hasFall':True,'falling':True,'seekArrived':True},
 {'name':'seek-next-failed','stage':'next','subtask':907},
 {'name':'wait-out-car-next','stage':'next','subtask':829},
 {'name':'already-being-arrested-next','stage':'next','subtask':1000,'beingArrested':True},
])
cases.extend([
 {'name':'control-kill-hold','stage':'control','subtask':1000},
 {'name':'control-dead-finishes','stage':'control','subtask':1000,'health':0},
 {'name':'control-missing-finishes','stage':'control','subtask':1000,'missing':True},
 {'name':'control-falling-boundary','stage':'control','subtask':1000,'hasFall':True,'falling':True,'position':[3,0,2]},
 {'name':'control-falling-float-boundary','stage':'control','subtask':1000,'hasFall':True,'falling':True,'position':[3.00000001,0,2]},
 {'name':'control-falling-outside-horizontal','stage':'control','subtask':1000,'hasFall':True,'falling':True,'position':[3.0001,0,0]},
 {'name':'control-falling-outside-height','stage':'control','subtask':1000,'hasFall':True,'falling':True,'position':[0,0,2.0001]},
 {'name':'control-fall-getting-up','stage':'control','subtask':1000,'hasFall':True,'falling':False},
 {'name':'control-falling-refuses-abort','stage':'control','subtask':1000,'hasFall':True,'falling':True,'canAbort':False},
 {'name':'control-other-cop-arresting','stage':'control','subtask':1000,'beingArrested':True},
 {'name':'control-own-arrest-holds','stage':'control','subtask':1100,'beingArrested':True},
 {'name':'control-door-room-holds','stage':'control','subtask':722,'inVehicle':True},
 {'name':'control-door-blocked-switches-side','stage':'control','subtask':722,'inVehicle':True,'driverRoom':False},
 {'name':'control-passenger-blocked-switches-driver','stage':'control','subtask':728,'inVehicle':True,'passengerRoom':False},
 {'name':'control-suspect-entered-car','stage':'control','subtask':1000,'inVehicle':True,'melee':True},
 {'name':'control-suspect-entered-bike','stage':'control','subtask':1000,'inVehicle':True,'vehicleClass':9,'melee':True},
 {'name':'control-suspect-entered-boat','stage':'control','subtask':1000,'inVehicle':True,'vehicleClass':5,'melee':True},
])
for case in cases:
 u.mem_write(TASK,bytes(0x9000));u.mem_write(TASK+0x20,struct.pack('<Q',0 if case.get('missing')else TARGET));u.mem_write(TARGET+0x585,bytes([int(case.get('inVehicle',False))]));u.mem_write(TARGET+0x708,struct.pack('<Q',VEHICLE));u.mem_write(VEHICLE+0x734,struct.pack('<ii',case.get('vehicleClass',0),case.get('subclass',0)));u.reg_write(UC_ARM64_REG_X0,TASK);u.reg_write(UC_ARM64_REG_X1,COP);u.reg_write(UC_ARM64_REG_LR,SCRATCH);u.reg_write(UC_ARM64_REG_SP,SCRATCH+0x3f000);choice=None;weapon_events=[];down_times=[]
 u.mem_write(TARGET+0x6ac,struct.pack('<f',case.get('health',100)));u.mem_write(TARGET+8,struct.pack('<fff',*case.get('position',[0,0,0])));u.mem_write(TARGET+0x538,struct.pack('<Q',INTELLIGENCE));u.mem_write(TARGET+0x58c,bytes([64 if case.get('beingArrested')else 0]));u.mem_write(COP+0x720,struct.pack('<I',6));u.mem_write(TASK+0x10,struct.pack('<Q',SUBTASK));u.mem_write(SUBTASK,struct.pack('<Q',VTABLE));u.mem_write(VTABLE+0x28,struct.pack('<Q',GET_TYPE));u.mem_write(VTABLE+0x38,struct.pack('<Q',CAN_ABORT));u.mem_write(SUBTASK+0x20,bytes([case.get('subtaskFlags',0)]));u.mem_write(SUBTASK+0x5c,bytes([4 if case.get('seekArrived')else 0]))
 u.emu_start({'next':0x10042a1e8,'control':0x10042add8}.get(case.get('stage'),0x10042abe4),SCRATCH,count=10000)
 print(json.dumps({'input':case,'choice':choice,'weaponEvents':weapon_events,'downTimesMs':down_times,'returnedTask':u.reg_read(UC_ARM64_REG_X0)!=0,'retainedSubtask':u.reg_read(UC_ARM64_REG_X0)==SUBTASK}))
