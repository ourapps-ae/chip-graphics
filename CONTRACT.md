# Chip graphics component

## Purpose and facilities
`chip-graphics` turns an amount into stacks of discs and moves them. A greedy breakdown picks the largest denominations first and starts another stack after twelve chips; discs are drawn with a dashed edge and the value of the top chip; the amount is written under the pile. It also plans motion: every bet moving from in front of its owner to the pot at once, winnings moving from the pot to each winner, a bet moving from a seat to its spot (an all in being slower and larger), with the position of a pile at any moment of a flight. The denominations and their colours are settings, so a game of tokens worth 100, 20, 5 and 1 uses the same code as a casino set. It draws no cards and knows no game rules.

Facilities: `chip-graphics` (Chip piles, denomination breakdown, bets and winnings in motion).

## User inputs
`denominations`: the chip values, written as an optional name then whole numbers separated by spaces, always including 1 so every amount can be made: `casino 5000 1000 500 100 25 5 1` (default) or `tokens 100 20 5 1`. An aepm string setting may hold only letters, digits, spaces and hyphens, so the list cannot use commas; code may also pass an array. `chipColours`: the name of a colour set then optional `denomination-rrggbb` entries: `casino` (default) uses the casino colours, `mine 1000-e07b2a 25-2e8b57` overrides two; a denomination without an entry keeps its casino colour, or gets a spare colour if the casino set has none for it; ink is chosen to read on the disc. The amount label's border is the theme's primary colour.

- `denominations` (string, label; optional; default `casino 5000 1000 500 100 25 5 1`)
- `chipColours` (string, label; optional; default `casino`)

## Artefacts and dependencies
`component.json` maps every `implementation/` source into `components/chip-graphics/`:

- `implementation/android/src/main/java/ae/chips/ChipModel.kt` -> `components/chip-graphics/android/src/main/java/ae/chips/ChipModel.kt`
- `implementation/android/src/main/java/ae/chips/ChipViews.kt` -> `components/chip-graphics/android/src/main/java/ae/chips/ChipViews.kt`
- `implementation/apple/Sources/ChipModel.swift` -> `components/chip-graphics/apple/Sources/ChipModel.swift`
- `implementation/apple/Sources/ChipViews.swift` -> `components/chip-graphics/apple/Sources/ChipViews.swift`
- `implementation/web/chip-model.ts` -> `components/chip-graphics/web/chip-model.ts`
- `implementation/web/chips.css` -> `components/chip-graphics/web/chips.css`
- `implementation/web/chips.ts` -> `components/chip-graphics/web/chips.ts`

Dependencies: none.
`tools.lock.json` pins verification tools: node 26.5.0, python3 3.12.8, swiftc 6.4.2, kotlinc 2.2.0, java 26.0.1. Licence wording remains deferred.

## Provided interfaces
- `interfaces/chip-graphics.json` defines `chip-graphics` (ae/chip-graphics) version 1.0.0.

## Required interfaces
- `theme` (ae/theme) version 1.0.0, supplied by the recipe or application. Operations used: `interfaces/required/theme.json`.

## Integration
Web: link `web/chips.css`; call `pileEl(amount, { settings: { denominations, chipColours }, size, label, format })`; plan motion with `sweepToPot`, `awardPot` and `betFlight` using spots from the `table-layout` component, and play it with `launchFlights(container, flights, { project })`, where `project` turns a spot (a fraction of the table) into pixels. Apple: compile `ChipModel.swift` anywhere and `ChipViews.swift` in UIKit targets with the theme's Swift files; `ChipStyle(denominations:chipColours:)` once near the root with `.chipStyle(...)`; use `ChipPile` and `ChipFlightLayer`. Android: add `ChipModel.kt` and `ChipViews.kt` to a Compose module with the theme's Kotlin files and provide `LocalChipStyle`. Seat positions, the pot spot, the decision of when to sweep and what the amounts mean are the application's.

## Visual definition and connected examples
`visual/definition.json` maps its ports to the provided and required interfaces. `visual/examples/connected.json` connects the component to an illustrative application consumer. Both image formats and a text description are retained under `visual/output/`.

## Infrastructure
None. Local drawing only; no accounts, network or deployment.

## Verification
Node tests check the breakdown (largest first, adding back to the amount for many amounts, twelve to a stack, other denomination sets and a missing 1 refused), the settings grammar, colours (casino, overrides, spare colours, readable ink), pile layout (stack spacing, lift, which chips carry a value), short value text, the DOM of `pileEl`, and flights (sweep, award, the rise of a bet, an all in being slower, easing, landing order) including launching real timed flights against a stand-in page and cancelling them. The Apple check compiles and runs `tests/apple/main.swift` for macOS, comparing 36 breakdowns over three denomination sets, pile layouts, colours and flights with the TypeScript output, then type-checks all Swift with the theme's against the iOS simulator SDK. The Android check compares the same breakdowns and layouts (`tests/android/Expected.kt`); kotlinc was not available where this was written, so it has not been run, and `ChipViews.kt` (Compose) is only compiled by the application's Gradle build. Pixels are not compared.

- `node --test tests/web.test.ts` (web, required-local; tools: node 26.5.0)
- `python3 tests/native.py apple` (apple, platform; tools: python3 3.12.8, swiftc 6.4.2)
- `python3 tests/native.py android` (android, platform; tools: python3 3.12.8, kotlinc 2.2.0, java 26.0.1)

## Scenarios and presentation
A hand of 1,337 chips shows as one orange 1k chip, three black 100s, a green 25, two red 5s and two grey 1s; a call sends the caller's chips from their seat to the bet spot; at the end of a betting round every bet sweeps into the pot together; a winner's share flies from the pot to their stack; a game of tokens worth 100, 20, 5 and 1 shows blue 100 chips; a raise to everything is slower, larger and glows.

## Updates and removal
Patch updates replace files only. The component keeps no data; removal deletes its files and the application's imports of them.
