import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {readWorldIplLoadList} from '../src/assets/worldLoadList';
test('original load list excludes unused cross-reference placements while retaining all four Vegas districts',()=>{
 const paths=readWorldIplLoadList(readFileSync('public/play/world/files/gta.dat','utf8'));
 expect(paths.filter(p=>p.startsWith('ipl/vegas/'))).toEqual(['ipl/vegas/vegasn.ipl','ipl/vegas/vegass.ipl','ipl/vegas/vegase.ipl','ipl/vegas/vegasw.ipl']);
 expect(paths).not.toContain('ipl/vegas/vegaxref.ipl');expect(paths).toContain('ipl/leveldes/seabed.ipl');
});
test('load list preserves order, normalizes case, and ignores comments and non-map resources',()=>{
 expect(readWorldIplLoadList('# IPL DATA\\MAPS\\unused.IPL\nIPL DATA\\MAP.ZON\nIPL DATA\\MAPS\\LA\\LAe.IPL # scene\nIPL data/maps/SF/SFn.ipl')).toEqual(['ipl/la/lae.ipl','ipl/sf/sfn.ipl']);
 expect(()=>readWorldIplLoadList('# no maps')).toThrow();expect(()=>readWorldIplLoadList('IPL DATA/MAPS/a.ipl\nIPL data/maps/A.IPL')).toThrow();
});
