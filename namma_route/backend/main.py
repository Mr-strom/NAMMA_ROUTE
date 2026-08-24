from collections import defaultdict
from csv import DictReader
from typing import Any, Optional

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import math
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = os.path.join(os.path.dirname(__file__), "data")
TRIP_SAMPLE_LIMIT_PER_ROUTE = 12


class AssistiveBriefRequest(BaseModel):
    profile: dict[str, Any] = {}
    language: str = "en"
    selected_mode: str = "best"
    origin_label: str = ""
    destination_label: str = ""
    route_result: Optional[dict[str, Any]] = None
    comparison_options: list[dict[str, Any]] = []
    scanned_stop: Optional[dict[str, Any]] = None


class EmergencyDraftRequest(BaseModel):
    profile: dict[str, Any] = {}
    route_summary: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None


def haversine(lat1, lng1, lat2, lng2):
    r = 6371000
    p = math.pi / 180
    a = (
        0.5
        - math.cos((lat2 - lat1) * p) / 2
        + math.cos(lat1 * p)
        * math.cos(lat2 * p)
        * (1 - math.cos((lng2 - lng1) * p))
        / 2
    )
    return round(2 * r * math.asin(math.sqrt(a)))


def load_json(name):
    with open(os.path.join(DATA_PATH, name), encoding="utf-8") as handle:
        return json.load(handle)


def calc_bus_fare(distance_km: float) -> int:
    if distance_km <= 2:
        return 6
    if distance_km <= 4:
        return 12
    if distance_km <= 6:
        return 18
    if distance_km <= 14:
        return 23
    if distance_km <= 40:
        return 29
    return 32


def calc_auto_fare(distance_km: float) -> int:
    return round(30 + distance_km * 15)


def calc_metro_fare(distance_km: float, is_student: bool, is_senior: bool) -> int:
    base = 10
    if distance_km > 2:
        base = 15
    if distance_km > 4:
        base = 20
    if distance_km > 8:
        base = 30
    if distance_km > 15:
        base = 40
    if is_student:
        return round(base * 0.75)
    if is_senior:
        return round(base * 0.85)
    return base


ALL_STOPS = load_json("stops_clean.json")
ALL_ROUTES = load_json("routes_clean.json")
STOP_TIMES = load_json("stop_times_clean.json")
STOP_BY_ID = {stop["stop_id"]: stop for stop in ALL_STOPS}

ROUTE_NAME_TO_IDS = defaultdict(list)
for route in ALL_ROUTES:
    ROUTE_NAME_TO_IDS[route["route_name"]].append(route["route_id"])

ROUTE_ID_TO_TRIPS = defaultdict(list)
with open(os.path.join(DATA_PATH, "trips.txt"), encoding="utf-8", newline="") as handle:
    for row in DictReader(handle):
        route_id = row["route_id"]
        trip_id = row["trip_id"]
        existing = ROUTE_ID_TO_TRIPS[route_id]
        if len(existing) < TRIP_SAMPLE_LIMIT_PER_ROUTE:
            existing.append(trip_id)

TRACKED_TRIP_IDS = {trip_id for trip_ids in ROUTE_ID_TO_TRIPS.values() for trip_id in trip_ids}

TRIP_STOPS = defaultdict(list)
with open(os.path.join(DATA_PATH, "stop_times.txt"), encoding="utf-8", newline="") as handle:
    for row in DictReader(handle):
        trip_id = row["trip_id"]
        if trip_id not in TRACKED_TRIP_IDS:
            continue
        TRIP_STOPS[trip_id].append((int(row["stop_sequence"]), row["stop_id"]))

for trip_id, stop_rows in list(TRIP_STOPS.items()):
    stop_rows.sort(key=lambda item: item[0])
    TRIP_STOPS[trip_id] = [stop_id for _, stop_id in stop_rows if stop_id in STOP_BY_ID]


def build_route_option(route_name, origin_stop, destination_stop):
    route_ids = ROUTE_NAME_TO_IDS.get(route_name, [])
    best_option = None
    for route_id in route_ids:
        for trip_id in ROUTE_ID_TO_TRIPS.get(route_id, []):
            stop_ids = TRIP_STOPS.get(trip_id, [])
            if len(stop_ids) < 2:
                continue

            stop_positions = {stop_id: idx for idx, stop_id in enumerate(stop_ids)}
            origin_index = stop_positions.get(origin_stop["stop_id"])
            destination_index = stop_positions.get(destination_stop["stop_id"])
            if origin_index is None or destination_index is None or origin_index >= destination_index:
                continue

            segment_stop_ids = stop_ids[origin_index : destination_index + 1]
            segment_stops = [STOP_BY_ID[stop_id] for stop_id in segment_stop_ids if stop_id in STOP_BY_ID]
            if len(segment_stops) < 2:
                continue

            walk_to = origin_stop["distance_metres"]
            walk_from = destination_stop["distance_metres"]
            score = walk_to + walk_from + len(segment_stops) * 12
            candidate = {
                "route_name": route_name,
                "route_id": route_id,
                "trip_id": trip_id,
                "boarding_stop": origin_stop,
                "alighting_stop": destination_stop,
                "stop_count": max(1, len(segment_stops) - 1),
                "path": [{"lat": stop["lat"], "lng": stop["lng"]} for stop in segment_stops],
                "segment_stops": [
                    {
                        "stop_id": stop["stop_id"],
                        "stop_name": stop["stop_name"],
                        "lat": stop["lat"],
                        "lng": stop["lng"],
                    }
                    for stop in segment_stops
                ],
                "score": score,
            }
            if best_option is None or candidate["score"] < best_option["score"]:
                best_option = candidate
    return best_option


def build_route_options(origin_stops, dest_stops):
    route_options = []
    seen_route_names = set()
    for origin_stop in origin_stops:
        for destination_stop in dest_stops:
            common_routes = sorted(set(origin_stop.get("routes", [])) & set(destination_stop.get("routes", [])))
            for route_name in common_routes:
                if route_name in seen_route_names:
                    continue
                option = build_route_option(route_name, origin_stop, destination_stop)
                if option:
                    route_options.append(option)
                    seen_route_names.add(route_name)
    route_options.sort(key=lambda option: option["score"])
    return route_options[:5]


def build_route_plan_data(from_lat: float, from_lng: float, to_lat: float, to_lng: float):
    origin_stops = sorted(
        ({**stop, "distance_metres": haversine(from_lat, from_lng, stop["lat"], stop["lng"])} for stop in ALL_STOPS),
        key=lambda stop: stop["distance_metres"],
    )[:5]
    destination_stops = sorted(
        ({**stop, "distance_metres": haversine(to_lat, to_lng, stop["lat"], stop["lng"])} for stop in ALL_STOPS),
        key=lambda stop: stop["distance_metres"],
    )[:5]

    route_options = build_route_options(origin_stops, destination_stops)
    selected_route = route_options[0] if route_options else None
    origin_stop = selected_route["boarding_stop"] if selected_route else origin_stops[0]
    destination_stop = selected_route["alighting_stop"] if selected_route else destination_stops[0]
    return {
        "origin_stop": origin_stop,
        "destination_stop": destination_stop,
        "common_routes": [option["route_name"] for option in route_options],
        "route_options": route_options,
        "selected_route": selected_route,
        "walk_to_stop_m": origin_stop["distance_metres"],
        "walk_from_stop_m": destination_stop["distance_metres"],
    }


def estimate_compare_options(route_plan: dict[str, Any], direct_distance_km: float, profile: dict[str, Any], selected_mode: str):
    walk_to = route_plan.get("walk_to_stop_m", 0)
    walk_from = route_plan.get("walk_from_stop_m", 0)
    total_walk = walk_to + walk_from
    stop_count = route_plan.get("selected_route", {}).get("stop_count", 8) if route_plan.get("selected_route") else 8
    bus_minutes = max(12, round(total_walk / 150) + stop_count * 2)
    bus_cost = calc_bus_fare(max(1.0, direct_distance_km))
    auto_cost = calc_auto_fare(max(1.0, direct_distance_km))
    metro_cost = calc_metro_fare(max(1.0, direct_distance_km), profile.get("isStudent", False), profile.get("isSenior", False))
    assistance_mode = profile.get("assistanceMode", "standard")

    options = [
        {
            "id": "bus",
            "minutes": bus_minutes,
            "cost": bus_cost,
            "walkingMetres": total_walk,
            "labelKey": "compare.option.bus",
            "note": "Lowest public transport fare",
        },
        {
            "id": "auto",
            "minutes": max(10, round(direct_distance_km * 3)),
            "cost": auto_cost,
            "walkingMetres": 120,
            "labelKey": "compare.option.auto",
            "note": "Fastest door-to-door option",
        },
        {
            "id": "metro",
            "minutes": max(18, round(direct_distance_km * 2.2 + 6)),
            "cost": metro_cost,
            "walkingMetres": max(300, round(total_walk * 0.65)),
            "labelKey": "compare.option.metro",
            "note": "Stable fare with structured stations",
        },
        {
            "id": "best",
            "minutes": max(12, bus_minutes - 2),
            "cost": min(bus_cost + 10, metro_cost + 5),
            "walkingMetres": round(total_walk * 0.55),
            "labelKey": "compare.option.best",
            "note": "Balanced time, fare, and walking",
        },
    ]

    if assistance_mode in {"blind", "wheelchair"}:
        options[3]["minutes"] = max(12, bus_minutes - 4)
        options[3]["cost"] = bus_cost + 20
        options[3]["walkingMetres"] = round(total_walk * 0.45)
        options[3]["note"] = "Accessibility-first route with reduced walking"

    recommended_id = selected_mode if selected_mode in {"bus", "auto", "metro"} else "best"
    for option in options:
        option["recommended"] = option["id"] == recommended_id
    return options


def normalize_search_text(value: str) -> str:
    return " ".join(value.strip().lower().split())


def search_stops(query: str, limit: int = 8):
    query_norm = normalize_search_text(query)
    if not query_norm:
        return []

    ranked_matches = []
    for stop in ALL_STOPS:
        stop_name = stop["stop_name"]
        stop_name_norm = normalize_search_text(stop_name)
        stop_id_norm = stop["stop_id"].lower()
        routes = stop.get("routes", [])

        if query_norm == stop_name_norm or query_norm == stop_id_norm:
            rank = 0
        elif stop_name_norm.startswith(query_norm):
            rank = 1
        elif any(part.startswith(query_norm) for part in stop_name_norm.split()):
            rank = 2
        elif query_norm in stop_name_norm or query_norm in stop_id_norm:
            rank = 3
        else:
            continue

        ranked_matches.append(
            (
                rank,
                len(stop_name_norm),
                -len(routes),
                stop_name_norm,
                {
                    "stop_id": stop["stop_id"],
                    "stop_name": stop_name,
                    "lat": stop["lat"],
                    "lng": stop["lng"],
                    "routes": routes,
                },
            )
        )

    ranked_matches.sort(key=lambda item: item[:4])
    return [item[4] for item in ranked_matches[:limit]]


def find_stop(query: str):
    query_norm = normalize_search_text(query)
    exact = []
    partial = []
    for stop in ALL_STOPS:
        stop_id = stop["stop_id"].lower()
        stop_name = normalize_search_text(stop["stop_name"])
        if query_norm == stop_id or query_norm == stop_name:
            exact.append(stop)
        elif query_norm in stop_id or query_norm in stop_name:
            partial.append(stop)
    if exact:
        return exact[0]
    if partial:
        partial.sort(key=lambda stop: len(stop["stop_name"]))
        return partial[0]
    return None


@app.get("/nearby-stops")
def nearby_stops(lat: float = Query(...), lng: float = Query(...), limit: int = Query(3)):
    stops_with_distance = []
    for stop in ALL_STOPS:
        dist = haversine(lat, lng, stop["lat"], stop["lng"])
        stops_with_distance.append({**stop, "distance_metres": dist})
    stops_with_distance.sort(key=lambda stop: stop["distance_metres"])
    return {"stops": stops_with_distance[:limit]}


@app.get("/route-plan")
def route_plan(from_lat: float = Query(...), from_lng: float = Query(...), to_lat: float = Query(...), to_lng: float = Query(...)):
    return build_route_plan_data(from_lat, from_lng, to_lat, to_lng)


@app.get("/route-compare")
def route_compare(
    from_lat: float = Query(...),
    from_lng: float = Query(...),
    to_lat: float = Query(...),
    to_lng: float = Query(...),
    selected_mode: str = Query("best"),
    assistance_mode: str = Query("standard"),
    is_student: bool = Query(False),
    is_senior: bool = Query(False),
):
    route_plan_data = build_route_plan_data(from_lat, from_lng, to_lat, to_lng)
    profile = {
        "assistanceMode": assistance_mode,
        "isStudent": is_student,
        "isSenior": is_senior,
    }
    direct_distance_km = haversine(from_lat, from_lng, to_lat, to_lng) / 1000
    return {
        "route_plan": route_plan_data,
        "comparison_options": estimate_compare_options(route_plan_data, direct_distance_km, profile, selected_mode),
    }


@app.get("/stop-times")
def stop_times(stop_id: str = Query(...), limit: int = Query(5)):
    times = STOP_TIMES.get(stop_id, [])
    return {"stop_id": stop_id, "times": times[:limit]}


@app.get("/stop-lookup")
def stop_lookup(q: str = Query(...)):
    stop = find_stop(q)
    if not stop:
        return {"stop": None}
    return {"stop": stop}


@app.get("/stop-search")
def stop_search(q: str = Query(...), limit: int = Query(8)):
    return {"stops": search_stops(q, limit)}


@app.post("/assistive-brief")
def assistive_brief(payload: AssistiveBriefRequest):
    language = payload.language or "en"
    scanned_stop = payload.scanned_stop
    route_plan = None
    if payload.route_result:
        route_plan = payload.route_result.get("routePlan") or payload.route_result.get("route_plan")

    if scanned_stop:
        stop_name = scanned_stop.get("stop_name", "this stop")
        recommended = payload.comparison_options[0]["id"] if payload.comparison_options else "bus"
        if language == "kn":
            return {
                "summary": f"ನೀವು ಈಗ {stop_name} ನಿಲ್ದಾಣದಲ್ಲಿದ್ದೀರಿ. ಇಲ್ಲಿಂದ ಮುಂದಿನ ಪ್ರಯಾಣ ಆಯ್ಕೆಯನ್ನು ವಿವರಿಸಲಾಗಿದೆ.",
                "steps": [
                    f"{stop_name} ನಿಮ್ಮ ಪ್ರಸ್ತುತ ನಿಲ್ದಾಣವಾಗಿದೆ.",
                    f"{payload.destination_label or 'ಗಮ್ಯಸ್ಥಾನ'} ಕಡೆ ಹೋಗಲು ಶಿಫಾರಸಾದ ಆಯ್ಕೆ {recommended}.",
                    "ಅವಶ್ಯಕವಿದ್ದರೆ ಕುಟುಂಬಕ್ಕೆ ಸಂದೇಶ ಕರಡನ್ನು ಕೆಳಗೆ ಬಳಸಿ.",
                ],
                "voice_text": f"ನೀವು ಈಗ {stop_name} ನಿಲ್ದಾಣದಲ್ಲಿದ್ದೀರಿ. ಮುಂದಿನ ಶಿಫಾರಸಾದ ಆಯ್ಕೆ {recommended}.",
                "message_draft": f"ನಾನು {stop_name} ನಿಲ್ದಾಣದಲ್ಲಿದ್ದೇನೆ. ದಾರಿ ತಿಳಿಸಲು ಸಹಾಯ ಮಾಡಿ.",
                "lost_support": f"ಸ್ಕ್ಯಾನ್ ಮಾಡಿದ ನಿಲ್ದಾಣ: {stop_name}",
            }
        return {
            "summary": f"You are currently at {stop_name}. The next safe travel option is ready.",
            "steps": [
                f"{stop_name} is your current stop.",
                f"The recommended next option toward {payload.destination_label or 'your destination'} is {recommended}.",
                "Use the prepared message if you need help from family or a caregiver.",
            ],
            "voice_text": f"You are now at {stop_name}. The recommended next option is {recommended}.",
            "message_draft": f"I am at {stop_name}. Please help me with directions.",
            "lost_support": f"Scanned stop: {stop_name}",
        }

    route_name = ""
    boarding_stop = ""
    alighting_stop = ""
    if route_plan and route_plan.get("selected_route"):
        route_name = route_plan["selected_route"].get("route_name", "")
        boarding_stop = route_plan["selected_route"]["boarding_stop"].get("stop_name", "")
        alighting_stop = route_plan["selected_route"]["alighting_stop"].get("stop_name", "")

    if language == "kn":
        summary = f"{payload.origin_label or 'ಪ್ರಸ್ತುತ ಸ್ಥಳ'} ಇಂದ {payload.destination_label or 'ಗಮ್ಯಸ್ಥಾನ'} ವರೆಗೆ {route_name or 'ಶಿಫಾರಸಾದ ಮಾರ್ಗ'} ಸಿದ್ಧವಾಗಿದೆ."
        steps = [
            f"{boarding_stop or 'ಹತ್ತುವ'} ನಿಲ್ದಾಣದವರೆಗೆ ನಡೆಯಿರಿ.",
            f"{route_name or 'ಬಸ್'} ಗೆ ಹತ್ತಿರಿ.",
            f"{alighting_stop or 'ಇಳಿಯುವ'} ನಿಲ್ದಾಣದಲ್ಲಿ ಇಳಿಯಿರಿ.",
            f"{payload.destination_label or 'ಗಮ್ಯಸ್ಥಾನ'} ಕಡೆ ಕೊನೆಯಷ್ಟು ನಡೆಯಿರಿ.",
        ]
        return {
            "summary": summary,
            "steps": steps,
            "voice_text": f"{summary} {' '.join(steps)}",
            "message_draft": f"ನಾನು {payload.destination_label or 'ಗಮ್ಯಸ್ಥಾನ'} ಕಡೆ ಪ್ರಯಾಣಿಸುತ್ತಿದ್ದೇನೆ. ಶಿಫಾರಸಾದ ಮಾರ್ಗ {route_name or 'ಬಸ್'} ಆಗಿದೆ.",
            "lost_support": "ನೀವು ದಾರಿ ತಪ್ಪಿದರೆ ಹತ್ತಿರದ ನಿಲ್ದಾಣದ QR ಅನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ.",
        }

    summary = f"{route_name or 'The suggested route'} is ready from {payload.origin_label or 'your location'} to {payload.destination_label or 'your destination'}."
    steps = [
        f"Walk to {boarding_stop or 'the boarding stop'}.",
        f"Board {route_name or 'the selected bus'}.",
        f"Get down at {alighting_stop or 'the destination stop'}.",
        f"Walk the last stretch to {payload.destination_label or 'your destination'}.",
    ]
    return {
        "summary": summary,
        "steps": steps,
        "voice_text": f"{summary} {' '.join(steps)}",
        "message_draft": f"I am travelling to {payload.destination_label or 'my destination'} using {route_name or 'the suggested route'}.",
        "lost_support": "If you get lost, scan the nearest stop QR to identify your location.",
    }


@app.post("/emergency-draft")
def emergency_draft(payload: EmergencyDraftRequest):
    location = ""
    if payload.lat is not None and payload.lng is not None:
        location = f"https://maps.google.com/?q={payload.lat},{payload.lng}"
    name = payload.profile.get("name") or "Namma Route user"
    return {
        "sms_draft": f"SOS from {name}. {payload.route_summary} {location}".strip(),
        "voice_text": f"Emergency alert for {name}. {payload.route_summary}",
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "stops_loaded": len(ALL_STOPS),
        "routes_loaded": len(ALL_ROUTES),
        "trip_samples_loaded": len(TRACKED_TRIP_IDS),
    }
