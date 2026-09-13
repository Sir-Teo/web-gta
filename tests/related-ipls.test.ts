import { expect, test } from 'vitest';
import { relatedIplEntries } from '../src/assets/relatedIpls';
const entries = (names: string[]) => names.map(name => ({name,offset:2048,length:2048,archivedSectors:0}));
test('district stream matching follows the native case-insensitive prefix in directory order', () => {
  const files=entries(['LAe_stream2.ipl','lae_stream0.IPL','lae_stream_custom.ipl','lae2_stream0.ipl','lae_stream1.col','other_stream0.ipl']);
  expect(relatedIplEntries('DATA\\MAPS\\LA\\LAe.IPL',files)).toEqual([0,1,2]);
  expect(relatedIplEntries('/maps/la/LAe.ipl',files)).toEqual([0,1,2]);
  expect(relatedIplEntries('absent.ipl',files)).toEqual([]);
});
test('district selection rejects filenames without a static IPL stem and finds beyond 200 entries', () => {
  expect(()=>relatedIplEntries('.ipl',[])).toThrow('named static');
  expect(()=>relatedIplEntries('lae.dat',[])).toThrow('named static');
  expect(relatedIplEntries('lae.ipl',entries(Array.from({length:256},(_,i)=>`lae_stream${i}.ipl`)))).toHaveLength(256);
});
