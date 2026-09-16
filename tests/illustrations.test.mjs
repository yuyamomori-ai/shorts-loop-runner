import test from 'node:test';
import assert from 'node:assert/strict';
import {illustrationKind} from '../runner/illustrations.mjs';
import {scienceCardEvents} from '../runner/science-cards.mjs';
const base={start:0,end:3,duration:3,variant:0,overlay:'実験手順',labels:[],effect:'clean',diagramSpec:{type:'process',labels:['映像提示','誤情報提示','記憶検査'],sourceIds:['s1'],caption:'実験室での典型的手順'}};
test('illustrations keep verified labels and do not apply memory experiment art to chemistry',()=>{
 assert.equal(illustrationKind(base),'experiment');
 for(const label of base.diagramSpec.labels)assert(scienceCardEvents(base).includes(label));
 assert.equal(illustrationKind({...base,diagramSpec:{type:'process',labels:['圧力低下','泡'],sourceIds:['s1']}}),null);
});
test('the memory hook is illustrative and does not present a borrowed study caption',()=>{
 const hook={...base,hook:true,overlay:'記憶は上書き？',sentence:'記憶は上書き？'};
 assert.equal(illustrationKind(hook),'memory-question');
 assert(!scienceCardEvents(hook).includes('実験室での典型的手順'));
 assert(scienceCardEvents(hook).includes('説明用のイメージ'));
});
test('dark warning illustration retains dark lettering against the yellow banner',()=>{
 const drawing=scienceCardEvents({...base,variant:1,diagramSpec:undefined,labels:['警告','誤情報']});
 assert(drawing.includes('\\1c&H382718&\\fad(100,80)}警告'));
});
