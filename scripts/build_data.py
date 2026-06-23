import ast
import csv
import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PARKING_CSV = Path("/Users/ananya/Downloads/jan to may police violation_anonymized791b166.csv")
OUTPUT = ROOT / "data" / "parkpulse_data.json"

IST = timezone(timedelta(hours=5, minutes=30))
SEVERITY = {
    "PARKING IN A MAIN ROAD": 5,
    "DOUBLE PARKING": 5,
    "PARKING NEAR TRAFFIC LIGHT OR ZEBRA CROSS": 5,
    "PARKING NEAR ROAD CROSSING": 4,
    "PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC": 4,
    "PARKING OPPOSITE TO ANOTHER PARKED VEHICLE": 4,
    "PARKING ON FOOTPATH": 3,
    "NO PARKING": 3,
    "WRONG PARKING": 3,
    "DEFECTIVE NUMBER PLATE": 1,
}


def parse_dt(value):
    if not value or value == "NULL":
        return None
    value = value.replace("+00", "+00:00")
    try:
        return datetime.fromisoformat(value).astimezone(IST)
    except ValueError:
        return None


def parse_list(value):
    if not value or value == "NULL":
        return []
    try:
        parsed = ast.literal_eval(value)
        return parsed if isinstance(parsed, list) else [str(parsed)]
    except (SyntaxError, ValueError):
        return [value]


def clamp(value, low, high):
    return max(low, min(high, value))


def percentile(values, pct):
    if not values:
        return 0
    values = sorted(values)
    idx = clamp(round((len(values) - 1) * pct), 0, len(values) - 1)
    return values[idx]


def build_parking():
    hotspots = defaultdict(
        lambda: {
            "count": 0,
            "approved": 0,
            "rejected": 0,
            "sent": 0,
            "severity": 0,
            "violations": Counter(),
            "vehicle_types": Counter(),
            "hours": Counter(),
            "days": Counter(),
            "months": Counter(),
            "coordinates": [],
        }
    )
    station_counts = Counter()
    junction_counts = Counter()
    violation_counts = Counter()
    vehicle_counts = Counter()
    hour_counts = Counter()
    day_counts = Counter()
    month_counts = Counter()

    total = 0
    with PARKING_CSV.open(newline="", encoding="utf-8-sig", errors="replace") as file:
        reader = csv.DictReader(file)
        for row in reader:
            total += 1
            try:
                lat = float(row["latitude"])
                lon = float(row["longitude"])
            except (TypeError, ValueError):
                continue

            dt = parse_dt(row.get("created_datetime"))
            hour = dt.hour if dt else None
            day = dt.strftime("%a") if dt else "Unknown"
            month = dt.strftime("%b %Y") if dt else "Unknown"
            station = (row.get("police_station") or "Unknown").strip() or "Unknown"
            junction = (row.get("junction_name") or "No Junction").strip() or "No Junction"
            vehicle = (row.get("vehicle_type") or "Unknown").strip() or "Unknown"
            status = (row.get("validation_status") or "NULL").strip() or "NULL"
            violations = parse_list(row.get("violation_type"))
            if not violations:
                violations = ["Unknown"]

            cell = (round(lat, 3), round(lon, 3))
            key = f"{station}|{junction}|{cell[0]:.3f}|{cell[1]:.3f}"
            item = hotspots[key]
            item["count"] += 1
            item["approved"] += 1 if status == "approved" else 0
            item["rejected"] += 1 if status == "rejected" else 0
            item["sent"] += 1 if row.get("data_sent_to_scita") == "TRUE" else 0
            item["severity"] += max(SEVERITY.get(v, 2) for v in violations)
            item["vehicle_types"][vehicle] += 1
            item["coordinates"].append((lat, lon))
            if hour is not None:
                item["hours"][hour] += 1
                hour_counts[hour] += 1
            item["days"][day] += 1
            item["months"][month] += 1

            station_counts[station] += 1
            junction_counts[junction] += 1
            vehicle_counts[vehicle] += 1
            day_counts[day] += 1
            month_counts[month] += 1
            for violation in violations:
                violation_counts[violation] += 1
                item["violations"][violation] += 1

    counts = [item["count"] for item in hotspots.values()]
    severity_values = [item["severity"] / max(item["count"], 1) for item in hotspots.values()]
    count_p95 = percentile(counts, 0.95) or 1
    severity_p95 = percentile(severity_values, 0.95) or 1
    peak_hours = {hour for hour, _ in hour_counts.most_common(5)}

    hotspot_rows = []
    for key, item in hotspots.items():
        station, junction, lat, lon = key.split("|")
        latitudes = [point[0] for point in item["coordinates"]]
        longitudes = [point[1] for point in item["coordinates"]]
        count = item["count"]
        avg_severity = item["severity"] / count
        peak_count = sum(item["hours"].get(hour, 0) for hour in peak_hours)
        peak_share = peak_count / count
        validation_confidence = item["approved"] / max(item["approved"] + item["rejected"], 1)
        junction_factor = 1.18 if junction != "No Junction" else 1
        raw_impact = (
            45 * min(count / count_p95, 1.6)
            + 25 * min(avg_severity / severity_p95, 1.4)
            + 18 * peak_share
            + 12 * validation_confidence
        ) * junction_factor
        dominant_violation, dominant_violation_count = item["violations"].most_common(1)[0]
        top_hour, _ = item["hours"].most_common(1)[0] if item["hours"] else ("NA", 0)
        hotspot_rows.append(
            {
                "id": len(hotspot_rows) + 1,
                "station": station,
                "junction": junction,
                "lat": round(sum(latitudes) / len(latitudes), 6),
                "lon": round(sum(longitudes) / len(longitudes), 6),
                "count": count,
                "_rawImpact": raw_impact,
                "avgSeverity": round(avg_severity, 2),
                "validationConfidence": round(validation_confidence, 2),
                "dominantViolation": dominant_violation,
                "dominantViolationShare": round(dominant_violation_count / count, 2),
                "topVehicle": item["vehicle_types"].most_common(1)[0][0],
                "topHour": top_hour,
                "peakShare": round(peak_share, 2),
                "hours": [item["hours"].get(hour, 0) for hour in range(24)],
            }
        )

    hotspot_rows.sort(key=lambda row: (row["_rawImpact"], row["count"]), reverse=True)
    visible_count = min(250, len(hotspot_rows))
    visible_raw_scores = [row["_rawImpact"] for row in hotspot_rows[:visible_count]]
    visible_min = min(visible_raw_scores) if visible_raw_scores else 0
    visible_max = max(visible_raw_scores) if visible_raw_scores else 1
    visible_span = visible_max - visible_min or 1

    for index, row in enumerate(hotspot_rows, start=1):
        row["rank"] = index
        rank_fraction = 1 - ((index - 1) / max(visible_count - 1, 1))
        raw_fraction = clamp((row["_rawImpact"] - visible_min) / visible_span, 0, 1)
        relative_priority = 0.75 * raw_fraction + 0.25 * clamp(rank_fraction, 0, 1)
        row["impact"] = round(55 + relative_priority * 45, 1)
        row["recommendation"] = recommendation_for(
            row["junction"],
            row["dominantViolation"],
            row["topHour"],
            row["impact"],
        )
        del row["_rawImpact"]

    top_10 = hotspot_rows[:10]
    simulated_clearance = sum(row["count"] * row["impact"] / 100 for row in top_10)
    baseline_weighted_risk = sum(row["count"] * row["impact"] / 100 for row in hotspot_rows[:250])

    return {
        "totalViolations": total,
        "hotspotCount": len(hotspot_rows),
        "dateRange": {"start": "Nov 2023", "end": "Apr 2024"},
        "topHotspots": hotspot_rows[:250],
        "stationCounts": [{"name": name, "count": count} for name, count in station_counts.most_common(12)],
        "junctionCounts": [{"name": name, "count": count} for name, count in junction_counts.most_common(12)],
        "violationCounts": [{"name": name, "count": count} for name, count in violation_counts.most_common(12)],
        "vehicleCounts": [{"name": name, "count": count} for name, count in vehicle_counts.most_common(10)],
        "hourCounts": [{"hour": hour, "count": hour_counts.get(hour, 0)} for hour in range(24)],
        "dayCounts": [{"day": day, "count": day_counts.get(day, 0)} for day in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]],
        "monthCounts": [{"month": month, "count": count} for month, count in month_counts.most_common()],
        "simulation": {
            "baselineWeightedRiskTop250": round(baseline_weighted_risk),
            "top10AddressableRisk": round(simulated_clearance),
            "top10RiskReductionPct": round(simulated_clearance / baseline_weighted_risk * 100, 1),
            "recommendedDeployment": "2 patrol units across the highest-risk corridor clusters during recurring peak windows",
        },
    }


def recommendation_for(junction, violation, top_hour, impact):
    hour_label = f"{top_hour}:00" if isinstance(top_hour, int) else "peak window"
    if "MAIN ROAD" in violation or "DOUBLE" in violation:
        action = "clear carriageway obstruction and tow repeat offenders"
    elif "FOOTPATH" in violation:
        action = "prioritize pedestrian path clearance"
    elif junction != "No Junction":
        action = "station officers upstream of the junction approach"
    else:
        action = "run mobile patrol sweeps and validate recurring curbside demand"
    priority = "Critical" if impact >= 80 else "High" if impact >= 65 else "Medium"
    return f"{priority}: {action} around {hour_label}."


def main():
    data = {
        "generatedAt": datetime.now(IST).isoformat(timespec="seconds"),
        "parking": build_parking(),
    }
    OUTPUT.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
