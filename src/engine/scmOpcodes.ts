import {requireAsset} from '../assets/binary';
import {SCM_COMMANDS} from '../assets/scmCommands';

const byName=new Map<string,number>();
for(const [opcode,command] of Object.entries(SCM_COMMANDS))byName.set(command.name,Number(opcode));

/** Resolve a command name from the pinned opcode table. Fails for unknown names. */
export function scmOpcode(name:string){
 const opcode=byName.get(name);requireAsset(opcode!==undefined,`Unknown SCM command name ${name}.`);return opcode;
}
