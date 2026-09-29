# Colour Shift

A one-page tool for finding colour pairings: random photos suggest a text colour and a background colour, which are scored for contrast and fine-tuned by hand.

Where the Figma layer name differs from the term, it's noted as _Figma_.

## Colours

**Pair**:
The text colour and background colour shown together, the thing the user is hunting for.
_Avoid_: palette, combo, scheme

**Text colour**:
The colour of the sample text. The one that moves by default when a level is chosen.
_Avoid_: foreground, FG

**Background colour**:
The colour behind the sample text.
_Avoid_: BG, fill

**Active colour**:
Whichever of the two colours is selected for editing. There may be none.
_Avoid_: current colour, focused colour

**Swap**:
Exchanging the text colour and background colour.
_Avoid_: flip, invert, reverse

**Colour picker**:
The control showing one colour's swatch and hex, which selects it as the active colour.
_Avoid_: swatch button, chip

**Colour mode**:
The model the sliders edit in: OKLCH, HSB or RGB. Changing it never changes the colour.
_Avoid_: colour space, format

**Channel**:
One of a colour mode's three values (e.g. hue, saturation, brightness), each with its own slider.
_Avoid_: component, axis

**Channel readout**:
The channel name and value, shown only while its slider is in use.
_Avoid_: value label, tooltip

## Contrast

**Contrast method**:
The standard used to score the pair: WCAG 2 or APCA.
_Avoid_: algorithm, algo, a11y mode
_Figma_: a11y switch

**Score**:
The pair's contrast value under the current method, shown with its grade (`AA 5.21:1`, `Content Lc 64.3`).
_Avoid_: rating, result
_Figma_: a11y score

**Grade**:
The official name for a contrast band: AAA, AA, AA Large, Incidental for WCAG; Preferred Body, Body, Content, Headline, Spot for APCA; otherwise Fail.
_Avoid_: rating, pass level

**Level**:
The threshold where a grade begins (WCAG 1.5, 3.0, 4.5, 7.0; APCA 30, 45, 60, 75, 90). Choosing one moves the active colour, or the text colour, until the pair just reaches it.
_Avoid_: threshold button, bump, target

**Passing level**:
The highest level the pair currently meets; it's the one highlighted.
_Avoid_: current grade, selected level

## Photos

**Photo**:
One Unsplash image the pair is drawn from.
_Avoid_: image, picture

**Photo stream**:
The sequence of photos the user moves through with the arrows, including ones loaded ahead.
_Avoid_: gallery, feed, carousel

**Credit**:
The photographer's name and Unsplash link, shown on every photo.
_Avoid_: attribution, caption

## Layout

**Stage**:
The main area: the colour panel beside the photo panel (stacked on mobile).
_Avoid_: header, hero, canvas

**Colour panel**:
The half of the stage filled with the background colour, holding the sample text.
_Avoid_: preview, colour side

**Photo panel**:
The half of the stage showing the photo, its credit and hover arrows.
_Avoid_: image panel

**Sample text**:
The editable text set in the text colour. Starts as "Aa".
_Avoid_: specimen, preview text

**Specimen font**:
The font the sample text is set in, one of seven.
_Avoid_: sample font, display font

**Dock**:
The bar pinned to the bottom holding the colour pickers, contrast controls, photo arrows and export.
_Avoid_: control bar, controls, toolbar, footer

**Slider panel**:
The panel above the dock with the colour mode tabs and three sliders. It's open exactly when there's an active colour.
_Avoid_: colour module, picker panel

**Grip**:
The handle on a slider. It expands on hover and while dragged.
_Avoid_: gripper, thumb, knob

**Export**:
The dock control for keeping a pair: copy the share link, or download the Markdown file.
_Avoid_: share menu, save

**Share link**:
A URL that reopens the same photo, pair, contrast method, swap state and sample text.
_Avoid_: permalink, deep link
