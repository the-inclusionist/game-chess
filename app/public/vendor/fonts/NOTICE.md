# The chess glyphs, and what was done to them

Three typefaces, each cut down to the **twelve codepoints a chessboard needs** — U+2654 to U+265F,
the Unicode chess block — and converted to WOFF2. Nothing else from any of them ships.

| shipped | family declared | from | original | subset |
|---|---|---|---|---|
| `symbols2-chess.woff2` | `Noto Sans Symbols 2` | [google/fonts `ofl/notosanssymbols2`](https://github.com/google/fonts/tree/main/ofl/notosanssymbols2) | 1,233,128 B | **2,684 B** |
| `stixmath-chess.woff2` | `STIX Two Math` | [google/fonts `ofl/stixtwomath`](https://github.com/google/fonts/tree/main/ofl/stixtwomath) | 1,517,976 B | **3,176 B** |
| `pecita-chess.woff2` | `HandwrittenChess` | [pecita.eu](https://pecita.eu/police-en.php), v5.4 | 863,636 B | **2,748 B** |

**8,608 bytes for all three**, against 3.6 MB of originals. That is the whole argument for vendoring
rather than linking, made concrete: it is smaller than one screenshot, it works with no network, and
it sends nobody's IP address to a third party.

## Licences

All three are **SIL Open Font License 1.1**. The full text of each is beside it —
`OFL-noto-sans-symbols-2.txt`, `OFL-stix-two-math.txt`, `OFL-pecita.txt`.

- **Noto Sans Symbols 2** — © 2022 The Noto Project Authors. No Reserved Font Name, so the subset
  keeps the family name.
- **STIX Two Math** — © 2001–2021 The STIX Fonts Project Authors, with Reserved Font Name
  **"TM Math"**. ⚠️ The reserved name is *TM Math*, not *STIX Two Math*, so the subset may keep the
  family name it has. STIX Fonts™ is a trademark of the IEEE; it is named here to say which
  typeface this is, which is what a trademark is for.
- **Pecita** — © 2009–2015 Philippe Cochy, with Reserved Font Name **"Pecita"**.
  ⚠️ **A subset is a Modified Version under the OFL, and a Modified Version may not carry the
  Reserved Font Name.** So this one is declared as `HandwrittenChess` and is not called Pecita
  anywhere a font is named. The panel still offers it under the designer's name, because that
  names the *design a player is choosing* rather than the font software, and saying where a
  typeface came from is what the licence asks for.

## Reproducing

```bash
python -m pip install fonttools brotli
python -m fontTools.subset <original> --unicodes=U+2654-265F --flavor=woff2 \
  --layout-features= --no-hinting --desubroutinize --name-IDs=1,2,3,4,6 \
  --output-file=<name>-chess.woff2
```

Pecita's family name is then rewritten in the `name` table, for the reason above.
