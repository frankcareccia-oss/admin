POS-14 — POS Smoke \& Regression Test Pack



Project: PerkValet

Scope: POS UI (Admin repo only)

Baseline Tag: pos-13-locked

Thread: POS-14 (QA only — no code changes)



1\. Purpose



This document defines manual smoke and regression tests for the POS UI flows after POS-13 hardening.



It validates:



Identity confirmation correctness



Fraud prevention (double-submit, circular flows)



UI gating and state reset



Dashboard ↔ Visit ↔ Reward integrity



All tests are traceable via pvUiHook TC-POS-\* identifiers.



2\. Preconditions



Backend running (locked)



Admin UI running



POS terminal provisioned



Logged in via /pos/login



Clean localStorage before first run



3\. Smoke Tests (Critical Path)

POS-SMOKE-01 — Login \& Provision



TCs:



TC-POS-LOGIN-UI-01 → TC-POS-LOGIN-UI-08



TC-POS-PROVISION-UI-01 → TC-POS-PROVISION-UI-04



Steps



Navigate to /pos/login



Enter valid terminal code



Complete provisioning if prompted



Expected



Login succeeds



Terminal status shows Ready



No access token displayed



POS-SMOKE-02 — Dashboard Identity Preview



TCs:



TC-POS-11-PREVIEW-01



TC-POS-11-PREVIEW-01S



Steps



Enter a valid 10-digit phone



Click Confirm



Expected



Confirm button disables during preview



Customer preview panel appears



Found customer shows name



New customer shows create form



POS-SMOKE-03 — Active Customer Banner



TCs:



TC-POS-13-BANNER-01



Steps



Confirm a phone successfully



Expected



Persistent Active Customer banner appears



Masked phone + name shown



Banner remains until cleared or edited



POS-SMOKE-04 — Visit Flow (Dashboard → Visit)



TCs:



TC-POS-11-GO-01



TC-POS-VISIT-UI-PREFILL-01



TC-POS-VISIT-UI-03



Steps



From dashboard, click Register Visit



Confirm visit



Expected



Phone + name locked



No edit/reward links available



Visit registers once



Success message shown



Dashboard refresh flag set



POS-SMOKE-05 — Reward Flow (Dashboard → Reward)



TCs:



TC-POS-11-GO-02



TC-POS-REWARD-UI-PREFILL-01



TC-POS-REWARD-UI-03



Expected



Same behavior as visit



Reward registers exactly once



4\. Fraud \& Abuse Regression Tests

POS-FRAUD-01 — Double Submit Protection



TCs:



TC-POS-13-DOUBLE-01



Steps



Confirm Visit



Attempt to click Confirm again



Expected



Button disabled after success



Count increments once only



POS-FRAUD-02 — Circular Navigation Block



TCs:



TC-POS-13-FRAUD-01



TC-POS-13-FRAUD-02



Steps



Complete Visit



Observe available navigation



Expected



No direct path to Reward



Must return to Dashboard



Identity must be reconfirmed



5\. Edit / Clear / Reset Behavior

POS-REG-01 — Edit Clears Identity



TCs:



TC-POS-11-DASH-EDIT-01



TC-POS-13-EDIT-02



Expected



Phone unlocked



Banner cleared



CTAs disabled



POS-REG-02 — Clear Resets State



TCs:



TC-POS-11-DASH-CLEAR-01



Expected



Phone input empty



No identity state remains



Focus returns to input



6\. Focus \& UX

POS-UX-01 — Focus Reliability



TCs:



TC-POS-13-FOCUS-01



Expected



Phone input auto-focused



Focus restored after clear



7\. Dashboard Refresh \& Last Action

POS-REG-03 — Last Action Message



TCs:



TC-POS-DASH-UI-LA-01



Expected



Visit/Reward summary shown



Timestamp formatted



Refresh hint visible



8\. Notes



Backend enforcement (idempotency, replay) validated indirectly



For discrepancies, use backend script:



scripts/pos\_reconcile\_db\_vs\_ndjson.js



END — POS-14

