import {hash} from '../../runner/providers.mjs';
import {visualClaims} from '../../lib/visual.mjs';
import {FREE_TRACK} from '../../runner/licensed-music.mjs';
// Test transport/approval fixtures only; these are not real rendered artifacts.
export function readyVisual(v){
 v.mediaManifest={credit:'test fixture',visualVersion:1,preview:false,narration:'OpenAI TTS',narrationVerified:true,audioStream:true,mechanicalQa:{passed:true},duration:30,sceneCount:10,maxSceneDuration:3,meaningfulChanges:9,explanationCount:2};
 v.mediaManifest.musicEvidence={...FREE_TRACK,mode:'licensed',acquiredAt:'2026-09-24T00:00:00Z'};
 v.mediaManifest.generatedImageCount=1;v.mediaManifest.generatedImages=[{id:'fixture-art',synthetic:true,model:'fixture',prompt:'transport test only',sha256:hash('fixture-art')}];
 v.visualQa={passed:true};v.qa.visual='passed';v.verifiedContentHash=hash(JSON.stringify(visualClaims(v)));return v;
}
