"""Fill data/raw/places/geocode.csv (address -> lat, lng) for plan addresses, using the GSI address search.

Only looks up addresses not already in the cache, so it is cheap to re-run.
Usage: python3 data/scripts/geocode.py
"""
import csv
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent
CACHE = DATA / "raw" / "places" / "geocode.csv"
API = "https://msearch.gsi.go.jp/address-search/AddressSearch?q="


def lookup(address):
    # GSI matches block level best; drop building names and floors after the street number.
    q = re.split(r"\s|　", address.strip())[0]
    with urllib.request.urlopen(API + urllib.parse.quote(q), timeout=10) as r:
        hits = json.load(r)
    if not hits:
        return None
    lng, lat = hits[0]["geometry"]["coordinates"]
    return lat, lng, hits[0]["properties"]["title"]


def main():
    cache = {}
    if CACHE.exists():
        cache = {r["address"]: r for r in csv.DictReader(CACHE.open(encoding="utf-8"))}
    addresses = set()
    for path in (DATA / "raw" / "plans").glob("*.csv"):
        for r in csv.DictReader(path.open(encoding="utf-8-sig")):
            if r.get("address"):
                addresses.add(r["address"].strip())
    for a in sorted(addresses - cache.keys()):
        hit = lookup(a)
        cache[a] = {"address": a, "lat": hit and hit[0], "lng": hit and hit[1], "matched": hit and hit[2]}
        print(("ok   " if hit else "miss ") + a)
        time.sleep(0.3)
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    with CACHE.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, ["address", "lat", "lng", "matched"])
        w.writeheader()
        w.writerows(sorted(cache.values(), key=lambda r: r["address"]))


if __name__ == "__main__":
    main()
