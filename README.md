# ParkPulse AI

AI-driven parking intelligence prototype for the Flipkart Gridlock hackathon theme: **Poor Visibility on Parking-Induced Congestion**.

## What It Does

ParkPulse AI turns Bengaluru illegal-parking records into an enforcement operating picture:

- detects hotspot cells from latitude and longitude clusters,
- ranks zones with a congestion impact score,
- recommends targeted patrol actions and peak deployment windows,
- simulates the addressable risk from clearing the top 10 hotspots,
- generates a daily deployment plan for enforcement units,
- explains every impact score with transparent score factors,
- includes a live simulation mode that pulses new hotspot priority.

## Data Used

- `jan to may police violation_anonymized791b166.csv`

The generated dashboard data lives in `data/parkpulse_data.json`.

## Run Locally

```bash
cd /Users/ananya/parkpulse-ai
python3 -m http.server 8080
```

Open:

```text
http://localhost:8080
```

Useful demo routes:

```text
http://localhost:8080/?mode=live
```

## Rebuild Analytics Data

```bash
cd /Users/ananya/parkpulse-ai
python3 scripts/build_data.py
```

## Prototype Scope

This is a browser prototype designed for judging and demonstration. The model is an explainable scoring engine rather than a black-box ML model, so traffic police reviewers can understand why each location is prioritized.
