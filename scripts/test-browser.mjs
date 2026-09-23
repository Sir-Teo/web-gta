// Runs the browser suite as two passes: the parallel project, then the load-sensitive quiet project with the
// machine to itself. They are separate invocations rather than a project dependency because Playwright skips a
// dependent project whenever any test in its dependency fails, and the parallel pass always has a few timing
// misses, so the quiet specs never ran in a full run. Arguments are forwarded to both passes.
import {spawnSync} from 'node:child_process';
const args=process.argv.slice(2);
let status=0;
for(const project of ['parallel','quiet']){
 // A filter that matches nothing in one project is not a failure of that project.
 const run=spawnSync('npx',['playwright','test',`--project=${project}`,'--pass-with-no-tests',...args],{stdio:'inherit'});
 if(run.status!==0)status=run.status??1;
}
process.exit(status);
