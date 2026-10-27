"""Capture the native skinned root callback for non-extracting vehicle pose blends."""
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


uc=Uc(UC_ARCH_ARM64,UC_MODE_ARM)
for page in [0x10013b000,0x10013c000,0x10013d000,0x100139000,0x1002cb000,0x10058e000,0x10058c000]:
 uc.mem_map(page,0x1000);uc.mem_write(page,data(page,0x1000))
uc.mem_map(0x20000000,0x20000)
uc.mem_map(0x100929000,0x1000)
def capture(layers,base,rest=[0,0,0],root=2):
 uc.mem_write(0x20000000,bytes(0x20000))
 frame,update,out=0x20000000,0x20000100,0x20000200
 uc.mem_write(0x1009298f8,struct.pack('<Q',0x20000400));uc.mem_write(0x20000418,struct.pack('<Q',0x20000500 if root else 0));uc.mem_write(frame,bytes([8 if root==2 else 24 if root==3 else 0]))
 uc.mem_write(frame+4,struct.pack('<3f',*rest));uc.mem_write(frame+0x10,struct.pack('<Q',out));uc.mem_write(update,struct.pack('<I',1))
 for i,row in enumerate([*layers,base]):
  node=0x20001000+i*0x100;assoc=node+0x40;seq=node+0xa0;keys=node+0xc0
  uc.mem_write(update+8+i*8,struct.pack('<Q',node));uc.mem_write(node+0x18,struct.pack('<Q',assoc));uc.mem_write(assoc+0x30,struct.pack('<f',row['amount']));uc.mem_write(assoc+0x46,struct.pack('<H',0x10 if i<len(layers) else 0))
  if row.get('valid',True):
   uc.mem_write(node+0x10,struct.pack('<Q',seq));uc.mem_write(seq+4,struct.pack('<HHQ',3 if row.get('translation') is not None else 1,1,keys))
   uc.mem_write(keys,struct.pack('<5f',*row['rotation'],0))
   if row.get('translation') is not None:uc.mem_write(keys+0x14,struct.pack('<3f',*row['translation']))
 uc.reg_write(UC_ARM64_REG_SP,0x2001f000);uc.reg_write(UC_ARM64_REG_X0,frame);uc.reg_write(UC_ARM64_REG_X1,update);uc.reg_write(UC_ARM64_REG_LR,0x2001e000)
 uc.emu_start(0x10013bb3c,0x2001e000,count=5000)
 if uc.reg_read(UC_ARM64_REG_PC)!=0x2001e000:raise RuntimeError('Native skinned frame callback did not return.')
 return {'input':{'layers':layers,'base':base,'rest':rest,'root':root},'rotation':list(struct.unpack('<4f',uc.mem_read(out,16))),'translation':list(struct.unpack('<3f',uc.mem_read(out+0x10,12)))}
rows=[]
for baseZ in [-.9,-.6,-.3,0,.3,1]:
 for partialZ in [-.6,0,.3]:
  for amount in [0,.25,.5,1]:
   base={'amount':1,'rotation':[0,0,0,1],'translation':[.1,.2,baseZ]}
   rows.append(capture([{'amount':amount,'rotation':[0,0,1,0],'translation':[-.3,.4,partialZ]}],base))
for sign in [-1,1]:
 for amount in [.25,.5,1]:
  rows.append(capture([{'amount':amount,'rotation':[0,0,sign,0],'translation':[1,2,3]},{'amount':1-amount,'rotation':[0,0,1,0],'translation':[3,2,1]}],{'amount':1,'rotation':[0,0,0,1],'translation':[.1,.2,.3]}))
rows.append(capture([{'amount':.5,'rotation':[0,0,1,0],'translation':None}],{'amount':1,'rotation':[0,0,0,1],'translation':None}))
if args.profiles:
 for row in json.loads(args.profiles.read_text()):rows.append(capture(**row['input']))
args.output.write_text(json.dumps({'source':'Actual native skinned root frame callback entered at 0x10013bb3c, 2D velocity path 0x10013ca34; BonePos zero, HasVelocity true, PedPosition pointer present, static uncompressed keyframes and no association extracts movement; no calls or arithmetic stubbed','sha256':sha256,'cases':rows},indent=2)+'\n');print(json.dumps({'cases':len(rows)}))
