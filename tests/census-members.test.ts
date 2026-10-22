import {expect,test} from 'vitest';
const modulePath='../scripts/port/source-members.mjs';
const {memberBody}=await import(modulePath);
test('census comments and inline authored markers stay with their own adjacent adapter',()=>{
 const source=`   native:()=>real(),
   partial:()=>{/* AUTHORED: partial integration. */standIn();},
   // A native command's own description.
   next:()=>native(),
   // AUTHORED: another partial command.
   other:()=>standIn(),
   last:()=>real(),`;
 expect(memberBody(source,1,3)).toBe('   native:()=>real(),');expect(memberBody(source,2,3)).toContain('AUTHORED: partial');expect(memberBody(source,2,3)).not.toContain('native command');expect(memberBody(source,4,3)).toContain("native command's own description");expect(memberBody(source,4,3)).not.toContain('AUTHORED');expect(memberBody(source,6,3)).toContain('AUTHORED: another');expect(memberBody(source,7,3)).not.toContain('AUTHORED');
});
