"""Reproducible synthetic Type 2 Diabetes forecasting research sandbox."""
from pathlib import Path
import json, math, csv, hashlib
import numpy as np
ROOT = Path(__file__).resolve().parents[1]
SEED = 2026
FEATURES = ['glucose_now','mean_1h','mean_3h','trend_30m','std_3h','carb_load','steps_1h','heart_rate','sleep_hours','hour_sin','hour_cos','age','bmi','hba1c','diabetes_years']

def generate(n=90, days=7, seed=SEED):
    rng=np.random.default_rng(seed); patients=[]
    for i in range(n):
        ehr={'id':f'SYN-{i+1:03d}','age':int(rng.integers(30,76)), 'bmi':round(float(rng.uniform(22,37)),1),'hba1c':round(float(rng.uniform(6.2,9.8)),1),'diabetes_years':int(rng.integers(1,19)), 'diagnosis':'Synthetic Type 2 Diabetes', 'medication_context':'Synthetic stable background therapy; no dosing model', 'synthetic':True}
        base=82+10*(ehr['hba1c']-6)+.8*(ehr['bmi']-25)+rng.normal(0,8)
        sensitivity=1.2+.22*(ehr['hba1c']-6)+rng.normal(0,.12)
        rows=[]; meal=0; slow=0; g=base; noise=0
        for t in range(days*96):
            hour=(t%96)/4
            if t%96==0: sleep=round(float(rng.uniform(4.5,9)),1)
            carbs=float(rng.uniform(35,95)) if t%96 in [32,52,80] and rng.random()<.9 else (float(rng.uniform(10,40)) if rng.random()<.025 else 0.)
            steps=int(rng.integers(350,1500)) if 6<hour<22 and rng.random()<.16 else int(rng.integers(0,90))
            meal=.78*meal+carbs; slow=.87*slow+.13*meal
            noise=.75*noise+rng.normal(0,2.8)
            target=base+sensitivity*slow+3*(7-sleep)+5*math.sin(hour*math.pi/12)-steps*.008
            g=.65*g+.35*target+noise
            observed=round(float(np.clip(g+rng.normal(0,3),50,360)),1)
            rows.append({'t':t,'glucose':None if rng.random()<.025 else observed,'carbs':round(carbs,1),'steps':steps,'heart_rate':round(float(68+steps*.012+rng.normal(0,4)),1),'sleep_hours':sleep})
        patients.append({'ehr':ehr,'readings':rows})
    return patients

def features(ehr, rows):
    """Only reads supplied history. No future observations or labels."""
    if len(rows)<12: raise ValueError('At least 12 readings (3 hours) required')
    w=rows[-12:]; raw=[r['glucose'] for r in w]
    if raw[-1] is None or sum(g is None for g in raw)>3: return None
    g=[]; last=next(v for v in raw if v is not None)
    for v in raw: last=last if v is None else v; g.append(last)
    load=sum(r['carbs']*math.exp(-(w[-1]['t']-r['t'])/5) for r in w)
    h=(w[-1]['t']%96)/4
    return [g[-1],float(np.mean(g[-4:])),float(np.mean(g)),(g[-1]-g[-3])/2,float(np.std(g)),load,sum(r['steps'] for r in w[-4:]),w[-1]['heart_rate'],w[-1]['sleep_hours'],math.sin(h*math.pi/12),math.cos(h*math.pi/12),ehr['age'],ehr['bmi'],ehr['hba1c'],ehr['diabetes_years']]

def samples(patients):
    X=[]; Y=[]; ids=[]
    for p in patients:
        for t in range(11,len(p['readings'])-8,4):
            f=features(p['ehr'],p['readings'][:t+1]); future=[r['glucose'] for r in p['readings'][t+1:t+9]]
            if f is not None and None not in future: X.append(f); Y.append(future); ids.append(p['ehr']['id'])
    return np.array(X),np.array(Y),np.array(ids)

def fit(X,Y,columns):
    A=X[:,columns]; mu=A.mean(0); scale=A.std(0); scale[scale<1e-8]=1
    Z=np.column_stack([np.ones(len(A)),(A-mu)/scale]); penalty=np.eye(Z.shape[1])*20;penalty[0,0]=0
    coef=np.linalg.solve(Z.T@Z+penalty,Z.T@Y)
    labels=(Y.max(1)>180).astype(float); w=np.zeros(Z.shape[1])
    for _ in range(35):
        prob=1/(1+np.exp(-np.clip(Z@w,-30,30))); s=prob*(1-prob)
        grad=Z.T@(prob-labels)+penalty@w
        step=np.linalg.solve(Z.T@(Z*s[:,None])+penalty+np.eye(len(w))*1e-7,grad)
        w-=step
        if np.linalg.norm(step)<1e-7: break
    return {'columns':columns,'mean':mu.tolist(),'scale':scale.tolist(),'coef':coef.tolist(),'logistic':w.tolist()}

def predict(model,X):
    Z=np.column_stack([np.ones(len(X)),(X[:,model['columns']]-model['mean'])/model['scale']])
    return np.clip(Z@np.array(model['coef']),40,400),1/(1+np.exp(-np.clip(Z@np.array(model['logistic']),-30,30)))

def scores(Y,F,p,threshold):
    y=Y.max(1)>180; pred=p>=threshold; tp=int(sum(y&pred)); fp=int(sum(~y&pred));fn=int(sum(y&~pred));tn=int(sum(~y&~pred))
    return {'mae_120':round(float(np.mean(abs(Y[:,-1]-F[:,-1]))),3),'mae_all_horizons':round(float(np.mean(abs(Y-F))),3),'precision':round(tp/max(tp+fp,1),4),'recall':round(tp/max(tp+fn,1),4),'f1':round(2*tp/max(2*tp+fp+fn,1),4),'brier':round(float(np.mean((p-y)**2)),4),'tp':tp,'fp':fp,'fn':fn,'tn':tn,'windows':len(Y),'event_prevalence':round(float(y.mean()),4)}

def main():
    patients=generate(); train=patients[:54];val=patients[54:72];test=patients[72:]
    X,Y,_=samples(train); V,W,_=samples(val); T,U,ids=samples(test)
    model=fit(X,Y,list(range(15))); vf,vp=predict(model,V)
    threshold=max(np.arange(.15,.86,.05), key=lambda t:scores(W,vf,vp,t)['f1'])
    q=np.quantile(abs(W-vf),.9,axis=0,method='higher')
    model.update({'features':FEATURES,'threshold':round(float(threshold),2),'interval90':q.tolist(),'version':'1.0.0','seed':SEED,'horizon_minutes':[15,30,45,60,75,90,105,120],'event_definition':'Any glucose >180 mg/dL in the next 8 readings (120 minutes)'})
    F,P=predict(model,T); result=scores(U,F,P,threshold)
    sensor=fit(X,Y,list(range(11))); sf,sp=predict(sensor,V);st=max(np.arange(.15,.86,.05),key=lambda t:scores(W,sf,sp,t)['f1']);sf,sp=predict(sensor,T)
    persist=np.repeat(T[:,0,None],8,axis=1)
    drift=np.clip(T[:,0,None]+T[:,3,None]*np.arange(1,9),40,400)
    rng=np.random.default_rng(SEED); unique=np.unique(ids); boot=[]
    for _ in range(300):
        selected=rng.choice(unique,len(unique),replace=True); ix=np.concatenate([np.flatnonzero(ids==s) for s in selected]);boot.append(float(np.mean(abs(U[ix,-1]-F[ix,-1]))))
    result['mae_120_patient_bootstrap_ci95']=[round(float(x),3) for x in np.quantile(boot,[.025,.975])]
    result['interval90_coverage_by_horizon']=[round(float(v),4) for v in np.mean(abs(U-F)<=q,axis=0)]
    result['new_onset_windows']=int(sum(T[:,0]<=180)); mask=T[:,0]<=180
    result['new_onset']=scores(U[mask],F[mask],P[mask],threshold)
    metrics={'seed':SEED,'data':'Entirely synthetic; same generator for training and test; no clinical validity established','split':{'train_patients':54,'validation_patients':18,'test_patients':18,'train_windows':len(Y),'validation_windows':len(W)},'fusion':result,'sensor_only':scores(U,sf,sp,st),'persistence':scores(U,persist,(T[:,0]>180).astype(float),.5),'linear_trend':scores(U,drift,(drift.max(1)>180).astype(float),.5),'threshold':model['threshold']}
    for folder in ['data','model','dashboard']: (ROOT/folder).mkdir(exist_ok=True)
    (ROOT/'model/model.json').write_text(json.dumps(model,indent=2))
    (ROOT/'model/metrics.json').write_text(json.dumps(metrics,indent=2))
    with (ROOT/'data/ehr.csv').open('w') as fp:
        writer=csv.DictWriter(fp,fieldnames=patients[0]['ehr'].keys());writer.writeheader();writer.writerows(p['ehr'] for p in patients)
    with (ROOT/'data/wearables.csv').open('w') as fp:
        writer=csv.DictWriter(fp,fieldnames=['patient_id',*patients[0]['readings'][0].keys()]);writer.writeheader()
        for p in patients: writer.writerows({'patient_id':p['ehr']['id'],**r} for r in p['readings'])
    payload={'model':model,'metrics':metrics,'patients':test[:6]}
    (ROOT/'dashboard/data.js').write_text('globalThis.TWIN_DATA='+json.dumps(payload,separators=(',',':'))+';\n')
    (ROOT/'model/parity_fixture.json').write_text(json.dumps({'ehr':test[0]['ehr'],'rows':test[0]['readings'][:100],'features':features(test[0]['ehr'],test[0]['readings'][:100])}))
    print(json.dumps(metrics,indent=2))
if __name__=='__main__': main()
