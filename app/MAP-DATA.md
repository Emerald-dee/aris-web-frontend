# Map data you need to supply

Two files go in `public/`. Nothing in the code approximates either of them — if a
file is missing the console says so on the map rather than drawing a guess.

```
public/
├── Railways.json           (you already have this)
└── nigeria-adm0.geojson    (needs downloading)
```

---

## 1. Nigeria national outline — `nigeria-adm0.geojson`

**Get it from geoBoundaries, ADM0 level, simplified.** ADM0 is the national
border; ADM1 is states, ADM2 is LGAs. Licensed CC-BY 4.0, so commercial use is
fine with attribution.

Easiest route — the Humanitarian Data Exchange mirror:

<https://data.humdata.org/dataset/geoboundaries-admin-boundaries-for-nigeria>

Download **`geoBoundaries-NGA-ADM0_simplified.geojson`** and rename it to
`nigeria-adm0.geojson`.

Or use the geoBoundaries downloader at <https://www.geoboundaries.org>, selecting
Nigeria → ADM0 → GeoJSON.

### One trap worth knowing

**Don't `curl` the `raw.githubusercontent.com` URL.** The geoBoundaries repo stores
these files in Git LFS, so the raw endpoint returns a 130-byte pointer stub:

```
version https://git-lfs.github.com/spec/v1
oid sha256:22bef6ad05ad...
size 85286
```

It saves with a `.geojson` extension and looks fine in a file listing, then fails
to parse. Use HDX or the geoboundaries.org UI instead. The real simplified file is
around 85 KB.

### Verifying you got the right file

Open it and check the bounding box is roughly `2.67, 4.28` to `14.68, 13.90`.
That's Nigeria — and it matches the `NIGERIA_MAX` pan limits already in
`app/lib/fleet.ts`.

Take the **simplified** version, not the full-resolution one. Full res is several
megabytes of coastline detail that's invisible at national zoom and costs you a
slow first paint on every load.

### Optional: state boundaries

`geoBoundaries-NGA-ADM1_simplified.geojson` gives all 37 states. Worth adding
later — your region filter is already state-based (Abuja, Kaduna, Lagos), so you
could highlight the selected state's outline instead of just flying the camera to
it. Not wired up yet; say the word.

---

## 2. Track classification — what I need from you

The console now draws **interstate** and **metro** track in different colours, but
`Railways.json` is your file and I don't know what properties it carries.

`app/lib/geo.ts` classifies each feature in this order:

1. a property named in `CLASS_PROPERTIES` holding a value like `metro`,
   `light_rail`, `tram`, `commuter`
2. a name property matching `/blue line/i`, `/light rail/i`, `/metro/i`
3. otherwise **interstate** (the safe default — most of the network is mainline)

To find out what your file actually has, run the app in dev and check the browser
console. `logTrackProperties()` prints a table of every property key and its
distinct values on load.

**Paste me that table and I'll narrow the classifier to your real data.** Right now
the heuristics are best-effort over unknown properties; with the actual property
names they become exact.

If the file has no usable classification property at all, the fallback is a
hardcoded list of metro line names or feature IDs. Slightly ugly, but honest and
correct — better than a heuristic that misclassifies track on an operations
display.

---

## What renders now

- **Outside Nigeria is dimmed** by a mask layer: a world-sized polygon with the
  country punched out as holes. Neighbours stay readable as context but the
  national edge is unmistakable.
- **The border** is a two-pass stroke — a light casing under a dark line — so it
  stays legible over both land and sea in either theme.
- **Interstate track** is navy (`#16457a` day, `#6fa5e0` night); **metro** is
  purple (`#7b3d95` / `#c98ad6`) and dashed. The dash matters: colour alone fails
  for anyone with a blue/purple confusion, and this is a display people make
  dispatch decisions from.
