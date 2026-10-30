# ScootNav v0.2
Legal-only scooter and e-bike routing for Boston, Cambridge and Brookline. Keyless, no secrets in this repo.

- Map: MapLibre GL + OpenFreeMap dark style; CyclOSM + city bike network behind the **Lanes** toggle.
- Routing: BRouter custom profile `profile/courier.brf` (PROFILE_VER c6), uploaded at runtime to brouter.de, with bikerouter.de (same BRouter engine) as automatic fallback.
- Search (V9): under 3 characters or a bare house number shows on-device saved and recent places only (no request). 3+ characters query Photon (komoot) biased to GPS, bbox -71.19,42.23,-70.99,42.40, keeps places (amenity/shop/building/office/...) and real addresses, sorted nearest first. Overpass name/address fallback (best effort). Nominatim is used only for a single lookup on Go or when picking a street-pinned address. Max 1 search request per second, debounced and aborted.
- V14: `service=alley` ways are blocked in both modes (Fenway "Private Alley NNN" ways carry no access tag), so drop-offs end on the street side.
- Proof: `proof/check.py` (R1-R5, CommAve, V14) and `proof/summary.json`; `proof/bikerouter/` is the same check on the public bikerouter.de engine.

Search © OpenStreetMap contributors via Photon. Routing BRouter.
