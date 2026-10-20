import unittest,sys,json
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src'))
from pipeline import generate,features,samples,fit,predict,ROOT
class PipelineTests(unittest.TestCase):
 def test_deterministic(self):
  self.assertEqual(generate(1,1),generate(1,1))
 def test_missing_abstention(self):
  p=generate(1,1)[0]; rows=p['readings'][:12]
  for r in rows:r['glucose']=120
  self.assertIsNotNone(features(p['ehr'],rows))
  rows[-1]['glucose']=None;self.assertIsNone(features(p['ehr'],rows))
  rows[-1]['glucose']=120
  for r in rows[:4]:r['glucose']=None
  self.assertIsNone(features(p['ehr'],rows))
 def test_no_future_leakage(self):
  p=generate(1,1)[0]; original=features(p['ehr'],p['readings'][:40])
  for r in p['readings'][40:]:r['glucose']=399;r['carbs']=999
  self.assertEqual(original,features(p['ehr'],p['readings'][:40]))
 def test_split_disjoint(self):
  p=generate(90,1); a={v['ehr']['id'] for v in p[:54]};b={v['ehr']['id'] for v in p[54:72]};c={v['ehr']['id'] for v in p[72:]}
  self.assertFalse(a&b or a&c or b&c)
 def test_model_dimensions(self):
  m=json.loads((ROOT/'model/model.json').read_text()); f=json.loads((ROOT/'model/parity_fixture.json').read_text())
  forecast,p=predict(m,np.array([f['features']]))
  self.assertEqual(forecast.shape,(1,8));self.assertTrue(np.all(np.isfinite(forecast)));self.assertTrue(0<=p[0]<=1)
 def test_targets_after_window(self):
  p=generate(1,1)[0]
  for r in p['readings']:r['glucose']=r['t']+100
  X,Y,_=samples([p]);self.assertEqual(X[0,0],111);self.assertEqual(Y[0].tolist(),list(range(112,120)))
 def test_ehr_changes_prediction(self):
  m=json.loads((ROOT/'model/model.json').read_text()); f=json.loads((ROOT/'model/parity_fixture.json').read_text());x=np.array([f['features']]);a,_=predict(m,x);x[0,13]+=1;b,_=predict(m,x);self.assertGreater(np.max(abs(a-b)),.01)
if __name__=='__main__':unittest.main()
