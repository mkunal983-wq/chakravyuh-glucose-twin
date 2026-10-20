'use strict';
const $=s=>document.querySelector(s),D=TWIN_DATA,M=D.model;let patient=0,t=145,timer=null,lastResult=null;const reviewed=new Set();
const fmt=v=>Math.round(v),pct=v=>`${Math.round(v*100)}%`,time=i=>`Day ${Math.floor(i/96)+1}, ${String(Math.floor((i%96)/4)).padStart(2,'0')}:${String((i%4)*15).padStart(2,'0')}`;
D.patients.forEach((p,i)=>{const o=document.createElement('option');o.value=i;o.textContent=p.ehr.id;$('#patient-select').append(o)});
function rows(){let r=D.patients[patient].readings.slice(0,t+1).map(x=>({...x}));if($('#missing').checked)r.at(-1).glucose=null;return r}
function draw(r,result,scenario){
 const svg=$('#chart'),w=900,h=360,left=50,right=875,top=18,bottom=310,start=Math.max(0,t-24),end=t+8;
 let vals=r.slice(-25).map(v=>v.glucose).filter(v=>v!==null);if(result.available)vals.push(...result.interval.flat());if(scenario?.available)vals.push(...scenario.forecast);
 const lo=Math.min(60,Math.floor(Math.min(...vals)/20)*20),hi=Math.max(240,Math.ceil(Math.max(...vals)/20)*20),x=i=>left+(i-start)/(end-start)*(right-left),y=v=>bottom-(v-lo)/(hi-lo)*(bottom-top);
 let out=`<rect x="${x(t)}" y="${top}" width="${x(end)-x(t)}" height="${bottom-top}" fill="#f1f5ed"/>`;
 for(let v=Math.ceil(lo/40)*40;v<=hi;v+=40)out+=`<line x1="${left}" y1="${y(v)}" x2="${right}" y2="${y(v)}" stroke="#e8eeea"/><text x="${left-10}" y="${y(v)+4}" text-anchor="end" fill="#70817b" font-size="12">${v}</text>`;
 out+=`<line x1="${left}" y1="${y(180)}" x2="${right}" y2="${y(180)}" stroke="#c3946d" stroke-dasharray="5 5"/><text x="${left+5}" y="${y(180)-7}" fill="#a3724c" font-size="11">Excursion threshold 180</text>`;
 let path='',active=false;r.slice(start).forEach(v=>{if(v.glucose===null){active=false;return}path+=`${active?'L':'M'}${x(v.t)},${y(v.glucose)} `;active=true});out+=`<path d="${path}" fill="none" stroke="#087e80" stroke-width="3"/>`;
 if(result.available){const points=result.forecast.map((v,i)=>[x(t+i+1),y(v)]);out+=`<polygon points="${result.interval.map((v,i)=>`${x(t+i+1)},${y(v[0])}`).concat(result.interval.map((v,i)=>`${x(t+i+1)},${y(v[1])}`).reverse()).join(' ')}" fill="#087e80" opacity=".12"/>`;out+=`<polyline points="${x(t)},${y(r.at(-1).glucose)} ${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#087e80" stroke-width="3" stroke-dasharray="7 5"/>`}
 if(scenario?.available)out+=`<polyline points="${scenario.forecast.map((v,i)=>`${x(t+i+1)},${y(v)}`).join(' ')}" fill="none" stroke="#b7652c" stroke-width="2" stroke-dasharray="4 4"/>`;
 out+=`<line x1="${x(t)}" y1="${top}" x2="${x(t)}" y2="${bottom}" stroke="#94aaa1" stroke-dasharray="3 4"/>`;
 for(const i of [start,start+8,start+16,t,t+8])out+=`<text x="${x(i)}" y="337" text-anchor="middle" fill="#70817b" font-size="12">${i===t?'NOW':i===t+8?'+2h':`${Math.floor((i%96)/4)}:${String(i%4*15).padStart(2,'0')}`}</text>`;
 svg.innerHTML=out;
}
function render(){
 const p=D.patients[patient],r=rows(),res=TwinEngine.infer(M,p.ehr,r);lastResult=res;const latest=r.at(-1),observed=r.slice(-96).filter(v=>v.glucose!==null),missing=r.slice(-12).filter(v=>v.glucose===null).length;
 $('#patient-name').textContent=p.ehr.id+' / Virtual patient';$('#patient-summary').textContent=`${p.ehr.age} years · Type 2 Diabetes · ${p.ehr.diabetes_years} years since synthetic diagnosis`;
 $('#clock').textContent=time(t)+' · 15-minute samples';$('#timeline').value=t;
 $('#ehr').textContent=`Synthetic patient record: ${p.ehr.id}. Age ${p.ehr.age} years. BMI ${p.ehr.bmi} kg/m². HbA1c ${p.ehr.hba1c}%. Diabetes duration ${p.ehr.diabetes_years} years. ${p.ehr.medication_context}. Source: project simulator, seed 2026. No identifying patient information.`;
 $('#current').innerHTML=latest.glucose===null?'Unavailable':`${fmt(latest.glucose)} <em>mg/dL</em>`;
 $('#trend').textContent=res.available?`${res.features[3]>=0?'+':''}${res.features[3].toFixed(1)} mg/dL per 15 min (30-min trend)`:'Awaiting valid CGM';
 $('#forecast').innerHTML=res.available?`${fmt(res.forecast[7])} <em>mg/dL</em>`:'Withheld';$('#probability').textContent=res.available?pct(res.probability):'—';$('#tir').textContent=observed.length?pct(observed.filter(v=>v.glucose>=70&&v.glucose<=180).length/observed.length):'—';
 $('#alert-title').textContent=!res.available?'Sensor check needed':res.alert?'Excursion flagged':'Below alert threshold';
 $('#alert-copy').textContent=!res.available?res.reason:`${pct(res.probability)} model score for any reading above 180 mg/dL in the next 2 hours. Review threshold: ${pct(M.threshold)}. ${latest.glucose>180?'The current reading is already above the excursion threshold.':'This is a forecast, not a diagnosis.'}`;
 $('#context').innerHTML=`<dt>HbA1c / historical</dt><dd>${p.ehr.hba1c}%</dd><dt>Sleep / latest logged</dt><dd>${latest.sleep_hours} hours</dd><dt>Steps / last hour</dt><dd>${r.slice(-4).reduce((s,x)=>s+x.steps,0)}</dd><dt>Forecast interval at +120 min</dt><dd>${res.available?res.interval[7].map(fmt).join('–')+' mg/dL':'Unavailable'}</dd>`;
 $('#quality').textContent=`${12-missing}/12 CGM readings available in the last 3 hours. Gaps within the window use forward fill; initial gaps use the first available value in the same past window.`;
 const extra=+$('#carbs').value;$('#carb-value').textContent=extra+' g';let scenario=null;
 if(extra&&res.available){const sr=r.map(v=>({...v}));sr.at(-1).carbs+=extra;scenario=TwinEngine.infer(M,p.ehr,sr);$('#scenario').textContent=`Hypothetical +120 min: ${fmt(scenario.forecast[7])} mg/dL (${fmt(scenario.forecast[7]-res.forecast[7])>=0?'+':''}${fmt(scenario.forecast[7]-res.forecast[7])} versus current forecast). Orange curve shows sensitivity.`}else $('#scenario').textContent=res.available?'Move the slider to explore model sensitivity.':'Scenario unavailable until data quality recovers.';
 $('#review-status').textContent=reviewed.has(`${patient}:${t}`)?'Reviewed locally for this replay time.':'';draw(r,res,scenario);
}
function stop(){clearInterval(timer);timer=null;$('#play').textContent='▶ Play stream'}
$('#play').onclick=()=>{if(timer){stop();return}$('#play').textContent='Ⅱ Pause stream';timer=setInterval(()=>{if(t>=663){stop();return}t++;render()},1100)};
$('#step').onclick=()=>{stop();t=Math.min(663,t+1);render()};$('#reset').onclick=()=>{stop();t=145;$('#carbs').value=0;$('#missing').checked=false;render()};$('#timeline').oninput=e=>{stop();t=+e.target.value;render()};$('#patient-select').onchange=e=>{stop();patient=+e.target.value;render()};$('#carbs').oninput=render;$('#missing').onchange=render;
$('#ehr-toggle').onclick=()=>{$('#ehr').hidden=!$('#ehr').hidden;$('#ehr-toggle').setAttribute('aria-expanded',String(!$('#ehr').hidden))};$('#review').onclick=()=>{reviewed.add(`${patient}:${t}`);render()};
$('#export').onclick=()=>{const record={synthetic:true,model_version:M.version,patient:D.patients[patient].ehr,replay_time:time(t),latest:rows().at(-1),prediction:lastResult,scenario_extra_carbs:+$('#carbs').value,scenario_note:'Scenario not included in prediction field; export records baseline inference',reviewed:reviewed.has(`${patient}:${t}`)};const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`${record.patient.id}-case-${t}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>{stop();document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!==b.dataset.view);document.querySelectorAll('.nav').forEach(v=>v.classList.toggle('active',v===b));$('#page-title').textContent=b.textContent.trim().slice(1).trim()});
const E=D.metrics;$('#metrics').innerHTML=`<div class="table-wrap"><table><thead><tr><th>Model</th><th>120-min MAE ↓</th><th>Precision ↑</th><th>Recall ↑</th><th>F1 ↑</th><th>Brier ↓</th></tr></thead><tbody>${[['fusion','EHR + sensor fusion'],['sensor_only','Sensor-only ablation'],['persistence','Persistence'],['linear_trend','Linear trend']].map(([k,n])=>`<tr><td>${n}</td><td>${E[k].mae_120.toFixed(1)} mg/dL</td><td>${pct(E[k].precision)}</td><td>${pct(E[k].recall)}</td><td>${E[k].f1.toFixed(3)}</td><td>${E[k].brier.toFixed(3)}</td></tr>`).join('')}</tbody></table></div><p class="evidence-note">Test windows: ${E.fusion.windows}. Event prevalence: ${pct(E.fusion.event_prevalence)}. Patient-bootstrap 95% interval for 120-min MAE: ${E.fusion.mae_120_patient_bootstrap_ci95.join('–')} mg/dL. Overlapping windows are correlated.</p>`;
$('#interval-evidence').textContent=`At +120 min, observed coverage of the nominal 90% interval is ${pct(E.fusion.interval90_coverage_by_horizon[7])}. Onset-only F1 (current CGM ≤180) is ${E.fusion.new_onset.f1}, over ${E.fusion.new_onset.windows} windows.`;
render();
