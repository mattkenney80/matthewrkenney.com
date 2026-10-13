#!/usr/bin/env python3
"""Build the web assets for the /experiments/crank page.

Reads a folder of full-size photographs (never modified) and writes:

  <out>/<stem>.webp     resized, EXIF-stripped copy for the browser
  <out>/manifest.json   ordered list of frames with size, date, color, and a
                        tiny base64 placeholder so each frame paints instantly

Frames are ordered by capture date (EXIF DateTimeOriginal), so turning the
crank forward moves through time. Photos with no date sort last, by name.

Run it inside a virtualenv that has Pillow, in isolated mode:

    python -I scripts/build_crank_images.py "<source dir>" public/crank

Python cannot run on the Cloudflare Worker that serves the site, so this is a
build-time step. Re-running is safe: unchanged outputs are skipped.
"""

from __future__ import annotations

import base64
import colorsys
import io
import json
import sys
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageOps

MAX_EDGE = 1200      # longest side of the delivered image, in pixels
WEBP_QUALITY = 76
PLACEHOLDER_EDGE = 24
EXIF_IFD = 0x8769
TAG_DATETIME_ORIGINAL = 36867
TAG_DATETIME = 306
EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def capture_date(img: Image.Image) -> str | None:
    """Return an ISO date string from EXIF, or None if the photo has none."""
    try:
        exif = img.getexif()
        raw = exif.get_ifd(EXIF_IFD).get(TAG_DATETIME_ORIGINAL) or exif.get(TAG_DATETIME)
    except Exception:
        return None
    if not raw:
        return None
    try:
        return datetime.strptime(str(raw).strip(), "%Y:%m:%d %H:%M:%S").isoformat()
    except ValueError:
        return None


def dominant_color(img: Image.Image) -> str:
    """A pleasing accent color: the most populous swatch that is not mud.

    A plain average of a photograph is usually a muddy grey. Quantizing and
    scoring swatches by saturation and brightness picks something that
    actually looks like the picture.
    """
    small = img.convert("RGB").resize((64, 64))
    q = small.quantize(colors=6, method=Image.Quantize.MEDIANCUT)
    palette = q.getpalette() or []
    counts = sorted(q.getcolors() or [], reverse=True)
    best, best_score = (120, 120, 120), -1.0
    total = sum(c for c, _ in counts) or 1
    for count, idx in counts:
        r, g, b = palette[idx * 3 : idx * 3 + 3]
        _, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        # prefer saturated, mid-bright swatches; weight lightly by area
        score = (s * 0.7 + 0.3) * (1 - abs(v - 0.6)) * (0.5 + count / total)
        if score > best_score:
            best, best_score = (r, g, b), score
    return "#%02x%02x%02x" % best


def placeholder(img: Image.Image) -> str:
    """A ~300 byte blurred stand-in, base64 encoded for inlining."""
    thumb = img.copy()
    thumb.thumbnail((PLACEHOLDER_EDGE, PLACEHOLDER_EDGE))
    buf = io.BytesIO()
    thumb.convert("RGB").save(buf, "WEBP", quality=40, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def process(src: Path, out_dir: Path) -> dict | None:
    stem = src.stem.lower()
    dest = out_dir / f"{stem}.webp"
    try:
        with Image.open(src) as opened:
            date = capture_date(opened)
            img = ImageOps.exif_transpose(opened)  # honor camera rotation
            img.load()
    except Exception as exc:  # unreadable or corrupt file
        print(f"  skip  {src.name}: {exc}", file=sys.stderr)
        return None

    orig_w, orig_h = img.size
    scale = min(1.0, MAX_EDGE / max(orig_w, orig_h))
    size = (round(orig_w * scale), round(orig_h * scale))

    resized = img.resize(size, Image.Resampling.LANCZOS) if scale < 1 else img
    fresh = not dest.exists() or dest.stat().st_mtime < src.stat().st_mtime
    if fresh:
        # No exif= argument: the saved copy carries no metadata, GPS included.
        resized.convert("RGB").save(dest, "WEBP", quality=WEBP_QUALITY, method=6)

    return {
        "id": stem,
        "src": f"/crank/{stem}.webp",
        "w": size[0],
        "h": size[1],
        "date": date,
        "color": dominant_color(resized),
        "lqip": placeholder(resized),
        "_fresh": fresh,
    }


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__)
        return 2
    src_dir, out_dir = Path(argv[1]), Path(argv[2])
    if not src_dir.is_dir():
        print(f"source folder not found: {src_dir}", file=sys.stderr)
        return 1
    out_dir.mkdir(parents=True, exist_ok=True)

    files = sorted(p for p in src_dir.iterdir() if p.suffix.lower() in EXTS)
    print(f"{len(files)} photographs in {src_dir}")

    frames: list[dict] = []
    for i, path in enumerate(files, 1):
        frame = process(path, out_dir)
        if frame:
            frames.append(frame)
        if i % 20 == 0:
            print(f"  {i}/{len(files)}")

    # chronological, undated last (then by name so the order is stable)
    frames.sort(key=lambda f: (f["date"] is None, f["date"] or "", f["id"]))
    rebuilt = sum(1 for f in frames if f.pop("_fresh"))

    manifest = {
        "count": len(frames),
        "generated": datetime.now().isoformat(timespec="seconds"),
        "frames": frames,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, separators=(",", ":")))

    dated = sum(1 for f in frames if f["date"])
    total = sum(p.stat().st_size for p in out_dir.glob("*.webp"))
    print(f"done: {len(frames)} frames ({rebuilt} written), {dated} dated, "
          f"{total / 1e6:.1f} MB of images")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
