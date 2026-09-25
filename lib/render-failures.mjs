// Only measured presentation failures can trigger rewriting. Network, audio
// provider, budget, factual, and rights failures are intentionally excluded.
export function presentationFailure(error) {
 const message=String(error?.message??error??'');
 return message==='字幕を読む時間が不足しています。台本を短くしてください。'||/^実際の音声尺が[\d.]+秒です。20〜60秒に収まる台本に修正してください。$/.test(message);
}
