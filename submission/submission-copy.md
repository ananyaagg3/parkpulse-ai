# Submission Copy

## Title

ParkPulse AI: Parking Congestion Intelligence for Bengaluru

## Theme

Poor Visibility on Parking-Induced Congestion

## Description

ParkPulse AI is an AI-driven parking intelligence prototype that helps Bengaluru Traffic Police move from reactive patrols to targeted, data-backed enforcement.

The system analyzes anonymized illegal-parking violation records to detect recurring parking hotspots, quantify their congestion impact, and recommend where and when enforcement teams should be deployed. Instead of showing only violation counts, ParkPulse creates an explainable Impact Score for each zone using violation density, road-obstruction severity, peak-hour recurrence, junction proximity, and validation confidence.

The working prototype includes:

- A Bengaluru hotspot map built from nearly 3 lakh parking violation records.
- Impact-ranked enforcement zones by police station, junction, violation type, and time window.
- A daily deployment plan showing which enforcement unit should go where, when, and what action to take.
- Explainable Impact Score factors: density, obstruction severity, peak recurrence, junction proximity, and evidence confidence.
- A 24-hour recurrence chart for each hotspot.
- Action recommendations such as tow priority, mobile sweeps, and junction approach deployment.
- A top-10 intervention simulation estimating the share of weighted hotspot risk that can be addressed through focused deployment.
- A live simulation mode that mimics incoming violations and temporarily raises priority for high-risk zones.

This helps enforcement teams prioritize high-impact areas such as Safina Plaza Junction, KR Market Junction, Elite Junction, Sagar Theatre Junction, and other recurring obstruction zones. The solution is practical because it can run on existing violation logs, camera inputs, police-station boundaries, and future live feeds without requiring a full infrastructure replacement.

## Instructions to Run

1. Download or unzip the source code.
2. Open a terminal in the project folder.
3. Run `python3 -m http.server 8080`.
4. Open `http://localhost:8080` in a browser.
5. Use the police-station filter, impact slider, hotspot table, and map points to inspect enforcement priorities.
6. Switch Mode to Live simulation to see hotspot priority pulses and updated before/after risk.

## Video Script

ParkPulse AI solves the problem of poor visibility on parking-induced congestion. Bengaluru has large volumes of parking violation records, but patrol teams still need to decide where enforcement will have the most traffic impact.

Our prototype converts those records into a live operating picture. Each hotspot receives an explainable Impact Score based on density, obstruction severity, peak recurrence, junction risk, and evidence confidence. The dashboard ranks priority zones, shows the dominant violation type, identifies the peak enforcement window, and recommends the best action.

For example, a high-impact junction can be marked for upstream officer deployment or towing, while non-junction clusters can be handled through mobile patrol sweeps. The upgraded prototype now also creates a daily deployment plan, explains every score factor, and includes a live simulation mode for incoming parking violations.

The expected outcome is faster prioritization, better use of manpower, and measurable reduction in congestion caused by illegal parking.
