import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,applyAction,digestable} from '../lib/core.mjs';
import {musicCatalog,selectMusic,musicPreferences} from '../lib/shorts-music.mjs';
const current=Date.parse('2026-09-16T02:00:00Z');
test('native music choices distinguish official dated Shorts ranks from requested songs',()=>{
 const v={genre:'科学',segments:[{text:'実験の仕組み'}]};
 const a=selectMusic(v,{},current);assert.equal(a.track.title,'3:03 PM');assert.equal(a.chart.rank,2);assert.equal(a.chart.country,'JP');assert.equal(a.attached,false);assert.equal(a.nativeAvailabilityVerified,false);
 const b=selectMusic({...v,requestedTrack:{title:'怪物',artist:'YOASOBI'}},{},current);assert.equal(b.chart,null);assert.equal(b.selection,'owner');
 const expired=selectMusic(v,{},current+10*86400000);assert.equal(expired.chart,null);assert.match(expired.reason,/未確認/);assert.equal(musicCatalog(current+10*86400000).fresh,false);
 assert.throws(()=>musicPreferences({tracks:[]}));assert.throws(()=>musicPreferences({selection:'attached'}));assert.throws(()=>musicPreferences({tracks:[{title:'<script>'}]}));
});
test('music changes invalidate approval and cannot mutate sent videos or claim attachment',()=>{
 const s=initialState(),v={id:'a',status:'approved',revision:1,qa:{},approvedDigest:'old'};s.live.videos.push(v);
 const before=digestable(v);applyAction(s,'selectMusic',{id:'a',track:{title:'好きすぎて滅！',artist:'M!LK'},attached:true},'live');
 assert.equal(v.musicChoice.attached,false);assert.equal(v.musicChoice.status,'pending_native_selection');assert.equal(v.status,'review');assert.equal(v.approvedDigest,undefined);assert.notEqual(digestable(v),before);
 v.youtubeId='sent';assert.throws(()=>applyAction(s,'selectMusic',{id:'a',track:{title:'blue'}},'live'));
 applyAction(s,'musicSettings',{selection:'fixed',tracks:[{title:'怪物'}]},'live');assert.equal(s.settings.music.selection,'fixed');
});
