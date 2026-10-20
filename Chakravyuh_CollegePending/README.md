# Chakravyuh Glucose Twin

**A Type 2 Diabetes digital twin proof-of-concept for the Digital Twin Challenge 2026.**

Chakravyuh combines synthetic historical EHR attributes with time-varying glucose and wearable observations, updates a virtual patient state, forecasts glucose for the next 120 minutes, and flags possible excursions for review in a doctor dashboard.

> Research demonstration only. All patient data is synthetic. The model is not clinically validated and has weak early-onset detection. It must not guide diagnosis, medication, or patient care.

## Team and submission status

| Required information | Value |
|---|---|
| Team name | Chakravyuh |
| College / incubator | **PENDING: provide the actual institution** |
| Team members (1–4 full-time students) | **PENDING: names and institution details** |
| Team leader | **PENDING: confirm the leader** |
| Leader email and phone | **PENDING: provide for the submission platform** |
| Public repository | https://github.com/mkunal983-wq/chakravyuh-glucose-twin |
| Submission platform receipt | **Not submitted; platform link and leader details needed** |

The GitHub account owner is not automatically assumed to be the team leader. Replace `CollegePending` in the project folder with the verified college name before final submission. Publish contact details in the README only if the team intends them to be public; the platform specifically requests the leader's contact details.

## Submission deliverables

- [Architecture diagram PDF](docs/Chakravyuh-Architecture.pdf)
- [Presentation PDF](docs/Chakravyuh-Presentation.pdf)
- [Editable PowerPoint with full speaker notes](docs/Chakravyuh-Presentation.pptx)
- [Narrated prototype demonstration MP4, 31:48](docs/Chakravyuh-Demo.mp4)
- [Full narration and chapter timings](docs/DEMO_SCRIPT.md)
- [Model card, methods, results and limitations](docs/MODEL_CARD.md)
- [Data dictionary and provenance](docs/DATA_DICTIONARY.md)
- [Submission checklist](docs/SUBMISSION_CHECKLIST.md)
- [MIT license](LICENSE)

The video is a narrated presentation with screenshots captured from the working prototype. Narration is synthetic, not a team member's voice. Download the MP4 if GitHub does not show an inline player. The team may also upload it as an unlisted YouTube video and add that URL here. Verify any organizer requirements concerning AI-assisted submissions and narration.

## Problem statement and healthcare use case

A recent CGM value alone does not capture a patient's changing glucose pattern or historical context. This project investigates a focused statistical digital twin for Type 2 Diabetes: given the most recent three hours of observations and a synthetic EHR, forecast the next eight 15-minute glucose readings and classify whether any exceed 180 mg/dL in the next two hours.

The clinician-facing concept supports reviewing a trajectory, inspecting the patient record, observing missing-data warnings, and exporting a synthetic case. It does not recommend a treatment. The forecast window is not a guarantee of two hours of advance warning. Ongoing high-glucose episodes count in the main event label; onset-only results are reported separately.

## Run the working dashboard

No installation or API key is required for the dashboard. Open `dashboard/index.html` in a modern browser. Alternatively, from this project folder:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory dashboard
```

Open `http://127.0.0.1:8765`. The initial state is a synthetic patient, and Play advances one 15-minute sample per second. Nothing connects to a real sensor.

### Repeatable demonstration

1. Select **SYN-076** and set replay position to **83** (Day 1, 20:45).
2. Observe current CGM about **177 mg/dL**, score **61%**, and **Excursion flagged**.
3. Inspect the EHR and uncertainty interval; the +120-minute endpoint is about **164 mg/dL**.
4. Add **60 g** in the scenario slider: the hypothetical endpoint is about **181 mg/dL**. This is model sensitivity, not a causal prediction.
5. Enable **Simulate a missing latest CGM reading**. Forecast and scenario are withheld.
6. Restore the reading, mark reviewed, and export the case JSON.
7. Open **Model evidence** to inspect baseline comparisons and onset-only limitations.

## Technical stack and model

- Python 3.12+ and NumPy 2.3.5 for generation, feature engineering, fitting and evaluation.
- Standard HTML/CSS/JavaScript for the responsive dashboard and browser inference.
- Multi-output ridge regression and regularized logistic regression, implemented in NumPy.
- Patient-specific EHR fused with dynamic features at each replay step.
- Training-only standardization; validation-only alert threshold and interval widths.
- Seed 2026; patient-disjoint train/validation/test split; exported coefficients and metrics.
- No live backend, EHR API, insulin model, LLM inference, cloud service, or real patient data.

## Reproduce training and tests

From the project folder:

```sh
python3 -m venv .venv
# macOS/Linux:
. .venv/bin/activate
# Windows PowerShell instead: .venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python src/pipeline.py
python -m unittest discover -s tests -v
node tests/parity.cjs
```

Node.js 18+ is needed only for the JavaScript test, not for opening the dashboard. The pipeline regenerates CSV data, fitted parameters, evaluation JSON and `dashboard/data.js`. Seven Python tests check determinism, patient disjointness, temporal boundaries, target alignment, missing-data protection and EHR sensitivity. JavaScript checks feature parity and withholding behavior. GitHub Actions runs the checks.

## Dataset and honest results

90 synthetic patients, 7 days each, 60,480 potential readings. Static fields: age, BMI, HbA1c and diabetes duration. Dynamic fields: CGM, steps, heart rate and sleep. Carbohydrate is a manual log. No actual data from Synthea, MIMIC-IV, Apple Health or Google Fit is used.

54 patients train, 18 validate, 18 test. There are 2,303 eligible test windows with 49 positive events (2.13%). Entire patients stay in one split. See [machine-readable metrics](model/metrics.json).

| Model | 120-min MAE (mg/dL) | Precision | Recall | F1 |
|---|---:|---:|---:|---:|
| EHR + sensor fusion | 13.205 | 76.47% | 26.53% | 0.3939 |
| Sensor-only | 13.620 | 53.19% | 51.02% | 0.5208 |
| Persistence | 15.136 | 77.27% | 34.69% | 0.4789 |
| Linear trend | 30.932 | 14.88% | 65.31% | 0.2424 |

**Fusion improves synthetic glucose regression but does not improve alert F1.** It misses 36 of 49 positive windows. Onset-only recall is **6.25%** (2 of 32), so the current classifier is not a reliable early-warning system. Nominal 90% interval coverage at +120 minutes is 87.67%. The 95% patient-bootstrap interval for 120-minute MAE is 12.344–14.023 mg/dL. These numbers come from a shared synthetic generator and cannot establish clinical performance, Indian population representation, or improved healthcare outcomes.

## Project layout

```text
Chakravyuh_CollegePending/
  dashboard/       runnable interface, browser engine and data bundle
  src/pipeline.py  complete reproducible generation/training/evaluation
  tests/           Python tests and JavaScript parity check
  data/            synthetic EHR and wearable CSVs
  model/           coefficients, metrics and parity fixture
  docs/            architecture, presentation, demo and documentation
  requirements.txt
  LICENSE
  README.md
```

## Privacy, safety and license

Only generated records are included. Inference stays in the browser; there are no analytics or external app requests. Local review markers are not a durable clinical audit trail. Uncertainty bands are empirical marginal bands, not personalized guarantees. Scenario changes are input perturbations, not treatment effects. The code and generated data use the MIT license. NumPy is BSD-licensed; third-party dependencies retain their own licenses. The recording uses a stock synthetic TTS voice, not voice cloning.

## References and challenge logistics

- NIDDK, [Clinical Targets for Continuous Glucose Monitoring Data](https://www.niddk.nih.gov/health-information/professionals/diabetes-discoveries-practice/clinical-targets-for-continuous-glucose-monitoring-data), for context on the conventional 70–180 mg/dL range. The benchmark threshold is not an individualized care target.
- [Synthea](https://synthetichealth.github.io/synthea/) is a possible future synthetic EHR source; it is not used by the submitted generator.
- Requirements are transcribed from the brief supplied by the team. It says the code deadline is to be announced, mentions both top-5 and top-10 shortlisting, and lists the summit for 20 November 2026 in Bengaluru. Confirm current dates and shortlist rules directly with Happiest Health; no deadline has been invented here.
