import csv, json, collections

# ── 1. Load stops ──────────────────────────────
stops = []
with open("data/stops.txt", encoding="utf-8-sig") as f:
    for row in csv.DictReader(f):
        stops.append({
            "stop_id":   row["stop_id"].strip(),
            "stop_name": row["stop_name"].strip(),
            "lat":       float(row["stop_lat"]),
            "lng":       float(row["stop_lon"]),
        })
print(f"Loaded {len(stops)} stops")

# ── 2. Load routes ─────────────────────────────
routes = {}
with open("data/routes.txt", encoding="utf-8-sig") as f:
    for row in csv.DictReader(f):
        routes[row["route_id"].strip()] = (
            row.get("route_short_name") or row["route_id"]
        ).strip()
print(f"Loaded {len(routes)} routes")

# ── 3. Load trips.txt to link trip_id → route_id
#    (stop_times links to trip_id, not route_id directly)
trip_to_route = {}
with open("data/trips.txt", encoding="utf-8-sig") as f:
    for row in csv.DictReader(f):
        trip_to_route[row["trip_id"].strip()] = row["route_id"].strip()
print(f"Loaded {len(trip_to_route)} trips")

# ── 4. Build stop → route names mapping via stop_times ──
stop_routes = collections.defaultdict(set)
stop_times_map = collections.defaultdict(list)
with open("data/stop_times.txt", encoding="utf-8-sig") as f:
    for row in csv.DictReader(f):
        trip_id = row["trip_id"].strip()
        stop_id = row["stop_id"].strip()
        route_id = trip_to_route.get(trip_id)
        if route_id:
            route_name = routes.get(route_id, route_id)
            stop_routes[stop_id].add(route_name)
        arrival_time = row.get("arrival_time")
        if arrival_time:
            stop_times_map[stop_id].append(arrival_time.strip())
print(f"Built route mapping for {len(stop_routes)} stops")

# ── 5. Merge route names into stops ────────────
for stop in stops:
    stop["routes"] = sorted(list(stop_routes.get(stop["stop_id"], [])))

# ── 6. Write output files ──────────────────────
with open("data/stops_clean.json", "w", encoding="utf-8") as f:
    json.dump(stops, f, ensure_ascii=False)

with open("data/routes_clean.json", "w", encoding="utf-8") as f:
    routes_list = [{"route_id": k, "route_name": v} for k, v in routes.items()]
    json.dump(routes_list, f, ensure_ascii=False)

# Store a compact list of times per stop for quick lookup
stop_times_clean = {}
for stop_id, times in stop_times_map.items():
    unique_times = sorted(set(times))
    stop_times_clean[stop_id] = unique_times[:40]

with open("data/stop_times_clean.json", "w", encoding="utf-8") as f:
    json.dump(stop_times_clean, f, ensure_ascii=False)

print("Done. Files written: stops_clean.json, routes_clean.json, stop_times_clean.json")
