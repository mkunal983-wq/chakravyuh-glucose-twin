(function(root){
'use strict';
function features(ehr, rows){
 if(rows.length<12) throw Error('At least 12 readings required');
 const w=rows.slice(-12),raw=w.map(r=>r.glucose);
 if(raw.at(-1)===null||raw.filter(v=>v===null).length>3)return null;
 let last=raw.find(v=>v!==null);const g=raw.map(v=>(last=v===null?last:v));
 const mean=a=>a.reduce((s,v)=>s+v,0)/a.length, avg=mean(g), h=(w.at(-1).t%96)/4;
 return [g.at(-1),mean(g.slice(-4)),avg,(g.at(-1)-g.at(-3))/2,Math.sqrt(mean(g.map(v=>(v-avg)**2))),w.reduce((s,r)=>s+r.carbs*Math.exp(-(w.at(-1).t-r.t)/5),0),w.slice(-4).reduce((s,r)=>s+r.steps,0),w.at(-1).heart_rate,w.at(-1).sleep_hours,Math.sin(h*Math.PI/12),Math.cos(h*Math.PI/12),ehr.age,ehr.bmi,ehr.hba1c,ehr.diabetes_years];
}
function infer(model,ehr,rows){
 const f=features(ehr,rows);if(!f)return {available:false,reason:'Forecast withheld: missing latest CGM or more than 3 missing readings in the last 3 hours.'};
 const z=[1,...model.columns.map((c,i)=>(f[c]-model.mean[i])/model.scale[i])];
 const forecast=model.horizon_minutes.map((_,j)=>Math.max(40,Math.min(400,z.reduce((s,v,i)=>s+v*model.coef[i][j],0))));
 const logit=z.reduce((s,v,i)=>s+v*model.logistic[i],0);const probability=1/(1+Math.exp(-Math.max(-30,Math.min(30,logit))));
 return {available:true,features:f,forecast,probability,alert:probability>=model.threshold,interval:forecast.map((v,i)=>[v-model.interval90[i],v+model.interval90[i]])};
}
root.TwinEngine={features,infer};if(typeof module!=='undefined')module.exports=root.TwinEngine;
})(globalThis);
