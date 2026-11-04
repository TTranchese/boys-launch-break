"""Check the light-only design palette and generated CSS drift."""

from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent
OUTPUT = ROOT / "public" / "design-system"


def luminance(value):
    rgb = [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in rgb]
    return sum(v * w for v, w in zip(linear, (0.2126, 0.7152, 0.0722)))


def contrast(a, b):
    lo, hi = sorted((luminance(a), luminance(b)))
    return (hi + 0.05) / (lo + 0.05)


source = (SOURCE / "tokens.scss").read_text()
blocks = re.findall(r"([^{}]+)\{([^{}]*)\}", source)
light = {}
for selector, body in blocks:
    entries = dict(re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", body))
    light.update(entries)


def resolve(tokens, key):
    value = tokens[key].strip()
    while value.startswith("var("):
        value = tokens[value[4:-1]].strip()
    return value


pairs = [
    ("text", "canvas", 4.5), ("text", "surface", 4.5),
    ("text", "elevated", 4.5), ("muted", "elevated", 4.5),
    ("muted", "surface", 4.5), ("muted", "canvas", 4.5),
    ("muted", "subtle", 4.5), ("muted", "selected", 4.5),
    ("on-action", "action", 4.5), ("on-action", "action-hover", 4.5),
    ("on-action", "action-pressed", 4.5),
    ("accent", "surface", 4.5), ("accent", "canvas", 4.5),
    ("accent", "selected", 3), ("control-border", "surface", 3),
    ("control-border", "subtle", 3),
    ("control-border", "selected", 3),
    # Boundary tokens remain available for functional map controls.
    ("field-edge", "canvas", 3), ("field-edge", "surface", 3),
    ("success", "success-subtle", 4.5),
    ("warning", "warning-subtle", 4.5),
    ("danger", "danger-subtle", 4.5), ("danger", "subtle", 4.5),
    ("person-1", "surface", 4.5), ("person-2", "surface", 4.5),
    *[(f"person-{i}", "surface", 4.5) for i in range(3, 11)],
]
pairs += [("on-action", f"person-{i}", 4.5) for i in range(1, 11)]
pairs += [(role, surface, 4.5) for role in ("text", "muted")
          for surface in ("sky", "grass", "pink", "tangerine", "sunshine")]
for theme, tokens in (("light", light),):
    ratios = []
    for foreground, background, minimum in pairs:
        ratio = contrast(resolve(tokens, f"--color-{foreground}"), resolve(tokens, f"--color-{background}"))
        assert ratio >= minimum, f"{theme}: {foreground}/{background} = {ratio:.2f} < {minimum}"
        ratios.append(ratio)
    print(f"{theme}: {len(pairs)} contrast pairs passed; minimum {min(ratios):.2f}:1")

subprocess.run(["node", str(SOURCE / "build.mjs"), "--check"], check=True)
