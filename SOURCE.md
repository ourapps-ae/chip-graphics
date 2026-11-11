# Source mapping

Reference revision: `19905b75dbea89fbfd424d67fe26c81aaed0e018`. Extracted from the `recipe/` folder of `ourapps-ae/OurPoker`; paths and line ranges are of the files there.

## Web

- `implementation/web/chip-model.ts` <- `web/src/chips.ts:4-31` (`DENOMS`, `CHIP_COLOURS`, `breakdown`) and `52-54` (`shortDenom`), and the layout arithmetic inside `pileEl` (`chips.ts:34-50`: lift `max(2, round(size * 0.22))`, stack spacing `size + 2`, label on the top chip when `size >= 14`) pulled out as pure `pileLayout`. Flight timing from `web/src/table.ts:213-217` (`FLY_MS` 450, `ALL_IN_MS` 700), `244-252` (bets sweep to the pot together), `270` (pot to winner), `302-316` (the rise from the previous bet; an all in slower) as `sweepToPot`, `awardPot`, `betFlight`, with `flightAt` easing and `allInScale` from `ios/OurPoker/Sources/Chips.swift:436` (all in pulse `1 + 0.5 sin(pi t)`). Generalised: the fixed `DENOMS` and `CHIP_COLOURS` became the `denominations` and `chipColours` settings (`parseDenominations`, `parseChipColours`, spare colours, `inkFor`, which are new), the `maxStack` of 12 is a parameter, and spots are arguments rather than the recipe's `betPos`, `POT`, `seatPos`. Left behind: card flights, the showdown showcase, fold flights, check callouts and `markLandings` bookkeeping (`table.ts:222-330, 533-600`).
- `implementation/web/chips.ts` <- `web/src/chips.ts:33-50` (`pileEl`) and `web/src/table.ts:551-585` (`launch`: an overlay of flights moved by a CSS transition, started after each delay, removed on landing). Generalised: `launchFlights` takes the container, a projector from spots to pixels and a landing callback; the recipe redrew the whole table at each landing, the callback is the application's choice. `chips()` formatting became the `format` option (default digits with commas).
- `implementation/web/chips.css` <- `web/src/style.css:315-329, 330-333 (pilebox, pile, chip, amount, fx, flight)`. `--gold` became the theme's `--primary`. Left behind: `.spot`, `.deckcard`, `.potbox`, `.flight .tag`.

## Apple

- `implementation/apple/Sources/ChipModel.swift` <- `ios/OurPoker/Sources/Chips.swift:3-25` (denominations, colours, `breakdown`), `34-39` (layout arithmetic) and `219-223, 244-252, 263, 301-304` (flight timings and rules); same API as the web model, `Color` and `CGPoint` replaced by hex strings and `ChipPoint` so it compiles and runs without UIKit.
- `implementation/apple/Sources/ChipViews.swift` <- `Chips.swift:27-62` (`ChipPile`), `383-455` (`FlightLayer`, `FlightView`: the chip part only). Generalised: `chipFill` and `chipEdge` tables became `ChipStyle` (settings, theme tokens, amount format); `Palette.gold`, `chips(amount)` and `Palette.cardFace` come from `ChipStyle`. The value on the top chip is drawn (the recipe's Swift pile drew no value; the web one did). Left behind: `Spots`, `Flight` of cards and text, `FlightSpots`, `Showdown`, `TableEffects`, `GrowingClock`, `TurnLight` (`Chips.swift:64-381`).

## Android

- `implementation/android/src/main/java/ae/chips/ChipModel.kt` <- `android/app/src/main/java/app/ourapps/ourpoker/ui/Chips.kt:56-75` (`DENOMS`, `CHIP_FILL`, `CHIP_EDGE`, `breakdown`) and the flight rules at `Chips.kt:338-406, 416-417` (`ALL_IN_MS`, `FLY_MS`, the rise of a bet); as the Swift model.
- `implementation/android/src/main/java/ae/chips/ChipViews.kt` <- `Chips.kt:77-107` (`ChipPile`) and the flight drawing of chips. Generalised as the Swift view; the value on the top chip is not drawn here either. Left behind: `Spots`, card flights, `Showdown`, `ChallengeLayout`, clocks (`Chips.kt:109-514`).

## Tests

`tests/web.test.ts`, `tests/fake-dom.ts`, `tests/make-fixtures.ts`, `tests/fixtures/chips.json`, `tests/apple/main.swift`, `tests/android/Main.kt`, `tests/android/Expected.kt`, `tests/native.py`, `examples/consumer.ts` are new. `chips.json` and `Expected.kt` are generated from the TypeScript; the web test fails if they drift.
