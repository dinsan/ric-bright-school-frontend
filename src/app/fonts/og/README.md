Static Lexend instances (weights 400 and 800) for the share images (`opengraph-image.tsx`): `next/og` reads only
TTF, OTF or WOFF, and not variable fonts. Generated from `../lexend-latin-variable.woff2` with fontTools:

    python3 -c "from fontTools.ttLib import TTFont; from fontTools.varLib import instancer
    for w in (400, 800):
        f = instancer.instantiateVariableFont(TTFont('lexend-latin-variable.woff2'), {'wght': w}); f.flavor = None; f.save(f'og/lexend-{w}.ttf')"

Same licence as the variable font: SIL Open Font License 1.1 (`../OFL.txt`).
