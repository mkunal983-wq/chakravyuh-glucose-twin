# Chakravyuh Glucose Twin v1.0

## Intended use
Educational, synthetic Type 2 Diabetes digital twin proof-of-concept. The unit of prediction is a 3-hour history window. The output is eight glucose forecasts at 15-minute intervals and a separate score for any glucose above 180 mg/dL in the next 120 minutes. An event may already be underway. This is not a guarantee of detecting a spike two hours before onset.

## Model and fusion
`src/pipeline.py` builds 15 features from static EHR fields and recorded sensor history. Training-only standardization feeds multi-output ridge regression (L2=20, unpenalized intercept) and regularized logistic regression using Newton updates. The classifier is separate from the regression forecast: its score need not agree with a threshold applied to the mean forecast. Browser inference uses the exported JSON coefficients, not hard-coded predictions.

The last 12 readings provide current glucose, 1-hour and 3-hour averages, 30-minute trend, variability, exponentially decayed logged carbohydrate, recent steps, heart rate, sleep and time-of-day sine/cosine. Static inputs are age, BMI, HbA1c and diabetes duration. No future meal logs are visible to either model. Outputs are clipped to 40–400 mg/dL solely as a numerical guard, not as a clinical range.

## Data and split
Seed 2026 generates 90 virtual patients with 672 readings each (7 days at 15-minute intervals). There are 60,480 potential CGM readings. Approximately 2.5% are randomly missing. Every patient is assigned to exactly one split before window extraction: SYN-001–054 train, SYN-055–072 validation, SYN-073–090 test. Windows advance by an hour for evaluation and overlap in their labels. The dashboard offers six test patients and can replay every 15-minute step.

Training has 7,051 eligible windows, validation 2,311, and test 2,303. Windows require nonmissing future target readings. Latest-CGM missingness or over 3 missing readings in the 12-reading history causes abstention. Short internal gaps are forward-filled; leading gaps use the first available reading within the historical window. This does not access the forecast future, but it is a simplifying imputation rule. Inputs outside this generated schema are not supported.

## Validation choices
A threshold grid 0.15–0.85 in increments of 0.05 maximizes validation F1. Fusion chooses 0.60. The sensor-only model selects its own threshold using only validation. Per-horizon 90th percentiles of absolute validation residuals form nominal 90% marginal intervals. These are empirical intervals, not patient-specific uncertainty or simultaneous trajectory guarantees.

## Frozen test results
See `../model/metrics.json` for exact machine-readable results.

| Model | 120-min MAE, mg/dL | Precision | Recall | F1 | Brier |
|---|---:|---:|---:|---:|---:|
| EHR + sensor fusion | 13.205 | 0.7647 | 0.2653 | 0.3939 | 0.0145 |
| Sensor-only ablation | 13.620 | 0.5319 | 0.5102 | 0.5208 | 0.0156 |
| Persistence | 15.136 | 0.7727 | 0.3469 | 0.4789 | 0.0161 |
| Linear trend | 30.932 | 0.1488 | 0.6531 | 0.2424 | 0.0868 |

Fusion regression improves MAE, but its classifier has worse F1 than both sensor-only and persistence. This must be visible in presentations. Test prevalence is 2.13%, with only 49 positive windows. Fusion detects 13 and misses 36; it produces 4 false positives. Low Brier score partly reflects this rare outcome and does not establish calibration. Persistence and trend use binary event predictions, not calibrated probabilities.

The 95% patient-bootstrap interval for 120-minute MAE is 12.344–14.023 mg/dL (300 resamples of test patients, with replacement). It describes simulator sampling variability, not real-world performance. Empirical coverage at +120 minutes is 87.67%, below the nominal 90% level. Onset-only evaluation restricts current CGM to ≤180: 2,281 windows, 32 positives, 2 detected, 30 missed; recall 6.25%, F1 0.1143. This prototype is not yet a reliable early-warning system.

## Limits and next experiments
The simulator is deliberately simple and not fitted to real physiology. Train/test share its equations. HbA1c and BMI partly determine the simulator baseline, so fusion gains are structurally favored. Sensor missingness is random rather than realistic. Meal timings are regular. The dataset is not representative of India, has no geography or socioeconomic variables, and cannot measure fairness across Indian populations. Medication changes, insulin dynamics, stress, illness and device drift are not modeled. The current probability score is not externally calibrated.

Future work: preserve this frozen benchmark; introduce separate generators for stress testing; compare against consented, licensed real-world data; pre-register onset-only and patient-level event metrics; measure lead time and alerts per patient-day; calibrate on a separate cohort; audit missingness and subgroup performance; obtain clinician and ethics review before any patient study. Do not retune on this test set and call it unseen.

## Safety and provenance
No real patient data, credentials, or identifying records. The dashboard runs locally with no analytics. Review markers last only for the browser session. Case exports contain synthetic records. The scenario slider measures model response to an input perturbation; it cannot predict a causal benefit of food, exercise or treatment. No medication advice is generated.

Source for the conventional 70–180 mg/dL CGM range: NIDDK, Clinical Targets for Continuous Glucose Monitoring Data, https://www.niddk.nih.gov/health-information/professionals/diabetes-discoveries-practice/clinical-targets-for-continuous-glucose-monitoring-data (accessed 20 October 2026). The 180 threshold is a fixed benchmark setting, not an individualized care target. Synthea is a potential future EHR source, not used in this submission: https://synthetichealth.github.io/synthea/.
