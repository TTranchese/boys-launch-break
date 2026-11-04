# Toca Boca — Style Reference
> sticker sheet on a crayon box. Stack bold rounded colour slabs, set every headline in heavy tight-tracked Wallop, and drop cartoon emoji stickers straight into the words.

**Theme:** light

Source measurements are normalized; roles and recommendations are interpreted. Font summary lists are independent, not paired by position. HTML examples are reconstructions, not source components.

Toca Boca is a kids’ games studio site that reads like a sticker sheet: a white canvas carrying inset 32px-radius colour slabs in Sky Blue #59acff and Grass Green #62d962, with Bubblegum Pink #ff8cbc, Tangerine #ff7040 and Sunshine Yellow #ffe359 taken straight from the four teeth and tongue of the mouth logo. All type is Midnight Mouth #101014. Headlines are set in Wallop, a chunky geometric grotesque, at 160px down to 40px with tracking near -4%, and cartoon emoji stickers replace letters inside words. Every control is a Midnight Mouth 9999px pill with a Daylight #f2f2ff label; there are no borders and no shadows, so flat colour and character art do all the work.

## Colors

| Name | Value | Role |
|------|-------|------|
| Midnight Mouth | `#101014` | The mouth of the logo, every headline and every pill button — a blue-black that frames the candy colours the way an outline frames a sticker |
| Paper | `#ffffff` | Page canvas, navigation background, the hero, the values and Bug Board sections and the footer |
| Sky Blue | `#59acff` | The largest surface on the page: the adiClub, adidas and Toca Boca World slabs and the Inclusion tile — the default band colour |
| Grass Green | `#62d962` | The Superfan slab and the Quality value tile — a second full-band colour that alternates with Sky Blue down the page |
| Daylight | `#f2f2ff` | Highlight news cards, the audience chooser panel, pill labels and the Play trailer pill — a faint lavender white |
| Bubblegum Pink | `#ff8cbc` | The Play value tile, the kid card in the audience chooser and pink logo art — the site’s own --color-primary token |
| Tangerine | `#ff7040` | The Innovation value tile and the logo’s tongue — the warmest colour, used on one tile at a time, never on text |
| Sunshine Yellow | `#ffe359` | Wiggling app-icon tiles at the edges of the app slider and the adult card in the audience chooser — small doses only |
| Ink | `#0a0a0a` | Inter body copy, card dates, footer address and legal text, and labels on Daylight pills — a touch blacker than Midnight Mouth |

## Typography

### Wallop — The voice of the site: Wallop Toca Boca (the font file’s own name), a custom cut of a heavy, compact geometric grotesque with a single-storey a and a straight-tailed y, served by next/font as one 700-weight file, so the CSS weights 400 and 600 both render as the same bold face. Headlines run 160px/144px at -6.4px down to 40px/44px at -1.6px (about -4% everywhere); buttons and nav are 18px/600 with no tracking.
- **Substitute:** Outfit, Arial, sans-serif
- **Licence:** commercial (the font file names it Wallop Toca Boca); buy a licence from its foundry, or use the substitute
- **Weights:** 400, 600
- **Sizes:** 16px, 18px, 24px, 40px, 56px, 80px, 112px, 160px
- **Line height:** 0.90, 1.00, 1.10, 1.20
- **Letter spacing:** -6.4px at 160px (-11.2px on sticker words); -4.48px at 112px; -3.2px at 80px; -2.24px at 56px; -1.6px at 40px; -0.96px at 24px; 0px at 18px and 16px

### Inter — The quiet second voice, used only for running text: card summaries and the footer address at 18px/400 with 21.6px line-height and -0.18px tracking, and card dates at 14px/400 with -0.14px tracking. It never sets a headline, button or nav label.
- **Substitute:** Arial, sans-serif
- **Licence:** open (SIL Open Font License); free to use and self-host
- **Weights:** 400
- **Sizes:** 14px, 18px
- **Line height:** 1.20
- **Letter spacing:** -0.18px at 18px; -0.14px at 14px

### Type Scale

| Role | Family | Weight | Size | Line Height | Letter Spacing |
|------|--------|--------|------|-------------|----------------|
| caption | Inter | 400 | 14px | 1.2 | -0.14px |
| footer-link | Wallop | 600 | 16px | 1.2 | 0px |
| body | Inter | 400 | 18px | 1.2 | -0.18px |
| button | Wallop | 600 | 18px | 1.2 | 0px |
| subheading | Wallop | 400 | 24px | 1.2 | -0.96px |
| lead | Wallop | 400 | 40px | 1.1 | -1.6px |
| heading-small | Wallop | 400 | 56px | 1.1 | -2.24px |
| heading | Wallop | 400 | 80px | 1 | -3.2px |
| section-display | Wallop | 400 | 112px | 1 | -4.48px |
| display | Wallop | 400 | 160px | 0.9 | -6.4px |

## Spacing & Layout

**Base unit:** 8px

**Density:** spacious

- **Page max-width:** 1440px
- **Section gap:** 160px
- **Card padding:** 32px
- **Element gap:** 24px

### Border Radius

- **buttons:** 9999px
- **cards:** 32px
- **slabs:** 32px
- **tiles:** 32px

## Components

### Mouth Logo Navigation Bar
**Role:** Top-level site navigation

A 100px-tall transparent bar with 24px side padding: the stacked mouth logo and toca boca wordmark at left, and Shop, Apps, About, Careers, Contact at right in Midnight Mouth Wallop 18px/600 with 24px gaps. No border, no shadow, no background fill.

### Sticker Headline Hero
**Role:** Opening statement

A Paper hero with only a centred three-line headline in Midnight Mouth Wallop 160px, 144px line-height and -6.4px tracking. Replace one letter in a word with a cartoon sticker (tracking tightens to -11.2px around it) and add a black hand-drawn spark burst at the last word.

### Midnight Pill Button
**Role:** Primary action

Midnight Mouth #101014 fill, Daylight #f2f2ff label in Wallop 18px/600 with no tracking, 9999px radius, 16px 24px padding, 53px tall; optional arrow or chevron icon after the label. No border and no shadow.

### Compact Midnight Pill Button
**Role:** In-card action

The card-sized version of the Midnight pill: #101014 fill, Daylight #f2f2ff Wallop 18px/600 label, 9999px radius, 8px 16px padding, 37px tall, usually with a north-east arrow; centred at the bottom of a Daylight card.

### Daylight Pill Button
**Role:** Secondary action

Daylight #f2f2ff fill with an Ink #0a0a0a Wallop 18px/600 label and a play-triangle icon, 9999px radius, 16px 24px padding, 53px tall. Sits beside a Midnight pill with a 24px gap on Sky Blue slabs.

### Section Title Block
**Role:** Centred section heading

A centred Midnight Mouth Wallop 112px heading at 112px line-height and -4.48px tracking, followed by a Wallop 24px subtitle at 28.8px line-height and -0.96px tracking; a sticker or sparkle doodle may hang off the first letter.

### Daylight Highlight Card
**Role:** News and release teaser

A 336px-wide Daylight #f2f2ff card with 32px radius and 32px padding, no border or shadow: a square rounded image, an Ink Inter 14px/400 date, a centred Wallop 24px title at -0.96px tracking, Inter 18px/400 summary, and a compact pill pinned at the bottom.

### Inset Colour Slab
**Role:** Feature section band

A Sky Blue #59acff or Grass Green #62d962 block with 32px radius, inset from the page edge, with 160px vertical padding. Place a 448px by 597px rounded portrait illustration at left and a centred Wallop 80px/80px headline at -3.2px tracking with one Midnight pill at right.

### Value Colour Tile
**Role:** Company value card

A 336px by 404px tile filled with Bubblegum Pink, Grass Green, Tangerine or Sky Blue, 32px radius, 32px padding around a rounded image, and a centred Midnight Mouth Wallop 40px label below. A black hand-drawn wave crosses from the image into the tile; four tiles sit in a row with 24px gaps.

### Key Art Media Frame
**Role:** Wide illustration inside a slab

A wide rounded frame (1392px by 783px) holding flat game key art, set inside a Sky Blue slab under the section title, with Ink Wallop 24px paragraphs below it. No border, no shadow; the art itself supplies all the colour.

### Sunshine App Tile
**Role:** App slider item

A Sunshine Yellow #ffe359 square with 32px radius holding an app icon, peeking in from the left and right edges of the Toca Boca World slab and wiggling on a spring; a row of black store badges sits centred above the slider.

### Audience Chooser Modal
**Role:** First-visit personalisation

A centred Daylight #f2f2ff panel with 32px radius over a dimmed page: a Midnight Mouth Wallop headline, then two 300px cards in Sunshine Yellow and Bubblegum Pink with 32px radius, each with a rounded character image and a compact Midnight pill (I’m an adult, I’m a kid).

### Paper Footer
**Role:** Site footer

A Paper footer with the large stacked mouth logo at left and three columns at right: Wallop 24px headings, Wallop 16px/600 social links with small monochrome icons and 8px gaps, and Inter 18px/400 address and legal text with underlined links and a COPPA badge.

## Do's and Don'ts

### Do
- Use Paper #ffffff as the canvas and break it with inset 32px-radius slabs of Sky Blue #59acff or Grass Green #62d962, one colour per section.
- Set hero headlines in Wallop 160px with 144px line-height and -6.4px tracking, centred, in Midnight Mouth #101014.
- Keep tracking at about -4% on every Wallop headline: -4.48px at 112px, -3.2px at 80px, -1.6px at 40px.
- Use Midnight Mouth #101014 pills with Daylight #f2f2ff Wallop 18px/600 labels, 9999px radius and 16px 24px padding for every primary action.
- Reserve Inter for running text only: 18px/400 at 21.6px line-height with -0.18px tracking, and 14px/400 dates.
- Apply the logo colours (Bubblegum Pink, Grass Green, Tangerine, Sky Blue) as whole-tile fills in a row of 32px-radius value tiles.
- Place cartoon emoji stickers inside headline words and hand-drawn black doodle lines across image edges.

### Don't
- Do not add box-shadows or borders to cards, slabs or buttons; the site measures none and stays flat.
- Do not set headlines in Inter or in a light weight; every heading is the heavy Wallop face.
- Do not use the candy colours for text; all type is Midnight Mouth #101014 or Ink #0a0a0a.
- Do not square off controls; every button is a 9999px pill and every card or slab is 32px.
- Do not run colour slabs edge to edge with hard corners; they sit inset with 32px rounded corners.
- Do not use gradients or tints for section backgrounds; slabs are single flat fills like Sky Blue #59acff.
- Do not open up tracking on Wallop headlines; keep it tight at about -4% of the size.

## Elevation

There is no elevation at all: no box-shadows, no borders and no outlines were measured anywhere. Depth comes from stacking flat colour — Daylight cards on Paper, illustrations inset inside Sky Blue or Grass Green 32px slabs, coloured value tiles with the image set 32px in from the edge — and from cartoon stickers and hand-drawn doodle lines that overlap card and image edges.

## Surfaces

- **Paper** (`#ffffff`) — Page canvas, hero, news and values sections, and footer.
- **Daylight** (`#f2f2ff`) — Highlight news cards and the audience chooser panel.
- **Sky Blue** (`#59acff`) — Inset 32px slabs for the adiClub, adidas and World sections.
- **Grass Green** (`#62d962`) — The inset Superfan slab and the Quality value tile.
- **Midnight Mouth** (`#101014`) — Pill buttons, the only dark surface on the page.

## Imagery

Imagery is almost entirely the studio’s own game art: flat, outlined cartoon characters with big heads and dot eyes, in candy colours on peach, purple or pastel backdrops, plus a few bright lifestyle photos of kids in the Quality and Inclusion tiles. Every image sits in a rounded frame inside a coloured card or slab, never full-bleed. Small glossy stickers (a rainbow heart, a noodle cup, a star, a heart-eyes face) are dropped into headline letters, and thick black hand-drawn lines (spark bursts, waves, loops) overlap image corners. Footer social icons are small monochrome glyphs; there is no stock photography and no abstract decoration.

## Layout

A centred, spacious single column inside a 1440px max width, with 24px side padding and 160px vertical section padding. A 100px transparent navigation bar holds the mouth logo at left and five Wallop links at right. The hero is nothing but a centred three-line 160px Wallop headline on Paper with stickers set into the words. Below it the page alternates Paper sections (a centred 112px title over a row of four 336px Daylight news cards with 24px gaps; four 336px value tiles; a two-column Bug Board block) with inset Sky Blue and Grass Green slabs that carry a 448px portrait illustration on one side and an 80px centred headline with one pill on the other. Every heading, paragraph and button is centre-aligned. The Toca Boca World slab ends in a wide rounded key-art frame, store badges and yellow app-icon tiles peeking in from both edges, and a light footer closes the page.

## Similar Brands

- **Duolingo** — Shares heavy rounded display type, flat saturated colour fields and a cast of outlined cartoon characters carrying the brand.
- **Headspace** — Uses friendly illustrated characters, soft rounded shapes and flat bright colour blocks instead of photography-led layouts.
- **Mailchimp** — Uses quirky hand-drawn illustration and bold flat colour sections to keep a product brand playful.
