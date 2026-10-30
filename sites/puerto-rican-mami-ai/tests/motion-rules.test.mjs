import assert from 'node:assert/strict';
import test from 'node:test';
import { MOTION_PATH, mp4Duration } from '../src/site/motion-rules.ts';

function box(name, contents) {
  const out = Buffer.alloc(8 + contents.length);
  out.writeUInt32BE(out.length); out.write(name,4); contents.copy(out,8); return out;
}
function movie(seconds, version=0) {
  const mvhd=Buffer.alloc(version?32:20);mvhd[0]=version;
  const at=version?20:12;mvhd.writeUInt32BE(1000,at);
  if(version)mvhd.writeBigUInt64BE(BigInt(Math.round(seconds*1000)),at+4);
  else mvhd.writeUInt32BE(Math.round(seconds*1000),at+4);
  return Buffer.concat([box('ftyp',Buffer.from('isom0000')),box('moov',box('mvhd',mvhd))]);
}
test('accepts v0 and v1 movie headers and supported boundary durations',()=>{
  assert.equal(mp4Duration(movie(2)),2);assert.equal(mp4Duration(movie(15)),15);
  assert.equal(mp4Duration(movie(20,1)),20);
});
test('rejects short, overlong, missing, truncated and malformed movie data',()=>{
  for(const bytes of [movie(1),movie(21),Buffer.from('not an mp4'),movie(5).subarray(0,26)])assert.equal(mp4Duration(bytes),null);
  const wrong=movie(5);wrong.writeUInt32BE(999999,16);assert.equal(mp4Duration(wrong),null);
  const zeroScale=movie(5);zeroScale.writeUInt32BE(0,44);assert.equal(mp4Duration(zeroScale),null);
});
test('permits only opaque site-owned reference paths, never arbitrary URLs or traversal',()=>{
  assert(MOTION_PATH.test('/files/assets/motion/'+'a'.repeat(32)+'.mp4'));
  for(const ref of ['https://example.com/a.mp4','/files/assets/motion/../secret.mp4','/files/assets/motion/video.mp4','/files/assets/motion/'+'a'.repeat(32)+'.mp4?url=x'])assert(!MOTION_PATH.test(ref));
});
