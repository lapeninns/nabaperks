"""Generate lossless web fonts: python -m pip install 'fonttools[woff]==4.60.2'."""
from pathlib import Path

from fontTools import subset
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont

FONT_DIRECTORY = Path(__file__).resolve().parents[1] / "assets" / "fonts"


def verify(source, generated, codepoints):
    """Keep every retained character's outline, advance and vertical metrics."""
    assert set(generated.getBestCmap()) == set(codepoints)
    source_glyphs = source.getGlyphSet()
    generated_glyphs = generated.getGlyphSet()
    for codepoint in codepoints:
        original = source.getBestCmap()[codepoint]
        result = generated.getBestCmap()[codepoint]
        before = DecomposingRecordingPen(source_glyphs)
        after = DecomposingRecordingPen(generated_glyphs)
        source_glyphs[original].draw(before)
        generated_glyphs[result].draw(after)
        assert before.value == after.value, hex(codepoint)
        assert source["hmtx"][original] == generated["hmtx"][result], hex(codepoint)
    assert source["head"].unitsPerEm == generated["head"].unitsPerEm
    for metric in ("ascent", "descent", "lineGap"):
        assert getattr(source["hhea"], metric) == getattr(generated["hhea"], metric)


for path in sorted(FONT_DIRECTORY.glob("*.ttf")):
    source = TTFont(path, recalcTimestamp=False)
    for latin_only in (False, True):
        font = TTFont(path, recalcTimestamp=False)
        codepoints = set(font.getBestCmap())
        if latin_only:
            codepoints = {cp for cp in codepoints if cp <= 0xFF or 0x2000 <= cp <= 0x206F}
            options = subset.Options()
            options.layout_features = ["*"]
            options.recalc_timestamp = False
            subsetter = subset.Subsetter(options=options)
            subsetter.populate(unicodes=codepoints)
            subsetter.subset(font)
        font.flavor = "woff2"
        output = path.with_name(path.stem + ("-Latin" if latin_only else "") + ".woff2")
        font.save(output)
        verify(source, TTFont(output), codepoints)
        print(f"Verified {output.name}: {len(codepoints)} characters, {output.stat().st_size} bytes")
