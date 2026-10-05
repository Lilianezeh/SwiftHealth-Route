"""Spike: prove "open now, nearest first" search works, including hours past midnight."""
from datetime import datetime, time
from math import asin, cos, radians, sin, sqrt
from zoneinfo import ZoneInfo
NIGERIA_TIME = ZoneInfo("Africa/Lagos")

def distance_in_km(lat1, lng1, lat2, lng2):
    """Straight-line distance between two map points (haversine formula; 6371 = Earth's radius in km)."""
    lat_change, lng_change = radians(lat2 - lat1), radians(lng2 - lng1)
    haversine = sin(lat_change / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(lng_change / 2) ** 2
    return 6371 * 2 * asin(sqrt(haversine))

def is_open_at(opening_hours, moment):
    """opening_hours = {weekday: (opens, closes)}, 0 = Monday. closes < opens means it runs past midnight."""
    today, now = moment.weekday(), moment.time()
    yesterday = (today - 1) % 7  # Monday's "yesterday" is Sunday (6)
    if today in opening_hours:
        opens, closes = opening_hours[today]
        if opens <= closes and opens <= now < closes:  # normal day, e.g. 08:00-21:00
            return True
        if closes < opens and now >= opens:  # late shift that started this evening, e.g. 20:00-02:00
            return True
    opens, closes = opening_hours.get(yesterday, (time(0), time(0)))  # no hours yesterday = closed
    return closes < opens and now < closes  # True if yesterday's late shift is still running

def find_open_places_nearest_first(places, my_lat, my_lng, moment):
    """Keep places that are trusted and open now, then sort them by distance from me."""
    trusted = [place for place in places if not place["flagged"] and not place["overdue_for_recheck"]]
    open_now = [place for place in trusted if is_open_at(place["hours"], moment)]
    return sorted(open_now, key=lambda place: distance_in_km(my_lat, my_lng, place["lat"], place["lng"]))

def make_place(name, lat, lng, opens, closes, flagged=False, overdue=False):
    hours = {day: (time(*opens), time(*closes)) for day in range(7)}  # same hours every day
    return {"name": name, "lat": lat, "lng": lng, "hours": hours, "flagged": flagged, "overdue_for_recheck": overdue}

places = [  # demo data only, not real facilities
    make_place("Night Pharmacy A", 6.4520, 7.5100, (20, 0), (2, 0)),
    make_place("Day Pharmacy B", 6.4400, 7.4950, (8, 0), (21, 0)),
    make_place("24h Clinic C", 6.4700, 7.5300, (0, 0), (23, 59)),
    make_place("Flagged Pharmacy", 6.4510, 7.5090, (0, 0), (23, 59), flagged=True),
    make_place("Overdue Clinic", 6.4515, 7.5095, (0, 0), (23, 59), overdue=True),
]

def names_open_at(hour, minute):  # I stand at 6.4500, 7.5080 on a Tuesday
    moment = datetime(2026, 10, 6, hour, minute, tzinfo=NIGERIA_TIME)
    return [place["name"] for place in find_open_places_nearest_first(places, 6.4500, 7.5080, moment)]
assert names_open_at(1, 30) == ["Night Pharmacy A", "24h Clinic C"]  # late shift still open at 01:30
assert names_open_at(3, 0) == ["24h Clinic C"]  # late shift closed by 03:00
assert names_open_at(10, 0) == ["Day Pharmacy B", "24h Clinic C"]  # nearest open place comes first
print("Spike passed: past-midnight hours, distance order and trust filter all work.")
