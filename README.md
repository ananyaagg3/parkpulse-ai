# ParkPulse AI

AI-driven parking intelligence prototype for poor visibility on parking-induced congestion.

## Live Demo

https://parkpulse-ai.vercel.app

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

## Rebuild Analytics Data

```bash
python3 scripts/build_data.py
```

## Prototype Scope

This is a browser prototype designed for demonstration. The model is an explainable scoring engine rather than a black-box ML model, so reviewers can understand why each location is prioritized.
