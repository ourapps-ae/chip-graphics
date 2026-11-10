# Chip graphics instructions

## For the agent
Select `ourapps-ae/chip-graphics`; connect `theme` to the theme component. Set `denominations` from the recipe's chips answer (starting chips and blinds decide which denominations are useful; always include 1) and leave `chipColours` at `casino` unless the user wants other colours.

- Select package `ourapps-ae/chip-graphics` version `0.4.0`.
- Settings to configure:
  - `denominations` (string, label; optional; default `casino 5000 1000 500 100 25 5 1`)
  - `chipColours` (string, label; optional; default `casino`)
- Connect the provided `chip-graphics` (ae/chip-graphics 1.0.0, OpenRPC 1.3.2 document `interfaces/chip-graphics.json`) to the consumer that needs it.
- Supply `theme` (ae/theme 1.0.0) from the component that provides it.
- No accounts or keys are needed.

## For the developer
Choose denominations so a typical stack is a handful of chips (a stack over twelve becomes two). Pass spots from `table-layout` as fractions of the table to the flight functions. Keep `chip-model` the single source of truth; regenerate the Swift and Kotlin fixtures with `node tests/make-fixtures.ts` after any change.

## How to check
From the component directory:

- `node --test tests/web.test.ts` (web, required-local; tools: node 26.5.0)
- `python3 tests/native.py apple` (apple, platform; tools: python3 3.12.8, swiftc 6.4.2)
- `python3 tests/native.py android` (android, platform; tools: python3 3.12.8, kotlinc 2.2.0, java 26.0.1)
- `python3.12 -B /Users/george/Projects/com/my/tools/check_component.py components/chip-graphics` validates the manifest, sidecars and runs the required-local suite.
