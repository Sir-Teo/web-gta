import {expect,test} from 'vitest';
import {pathDirection} from '../src/assets/pathDirection';
const from={area:1,node:2},to={area:2,node:2};
test('forward travel chooses same lanes toward the navigation anchor and opposite lanes away',()=>{
 const navi={attachedTo:to,sameLanes:2,oppositeLanes:0};
 expect(pathDirection(from,to,navi)).toEqual({lanes:2,reverseLanes:0,anchorMatchesEndpoint:true});
 expect(pathDirection(to,from,navi)).toEqual({lanes:0,reverseLanes:2,anchorMatchesEndpoint:true});
 navi.oppositeLanes=3;expect(pathDirection(to,from,navi).lanes).toBe(3);
});
test('preserves the native else branch for a non-endpoint anchor instead of rejecting the connection',()=>{
 const navi={attachedTo:{area:3,node:2},sameLanes:1,oppositeLanes:0};
 expect(pathDirection(from,to,navi)).toEqual({lanes:1,reverseLanes:1,anchorMatchesEndpoint:false});
 expect(pathDirection(to,from,navi).lanes).toBe(1);
 navi.sameLanes=0;expect(pathDirection(from,to,navi).lanes).toBe(0);
});
