import Foundation

// Chips as data: an amount becomes stacks of the application's denominations, drawn as discs with a
// dashed edge; bets move between spots on a schedule. Pure, no UI framework; matches web/chip-model.ts.
struct ChipPoint: Equatable {
    var x: Double
    var y: Double
}

struct ChipColour: Equatable {
    var fill: String
    var edge: String
    var ink: String
}

struct ChipStack: Equatable {
    let denom: Int
    let count: Int
}

struct PlacedChip: Equatable {
    let stack: Int, index: Int, denom: Int
    let x: Double, y: Double
    let label: Bool
}

struct PileLayout: Equatable {
    let width: Double, height: Double, lift: Double
    let chips: [PlacedChip]
}

struct ChipFlight: Equatable {
    let key: String
    let from: ChipPoint
    let to: ChipPoint
    let amount: Int
    let delayMs: Double
    let durationMs: Double
    let endMs: Double
    let allIn: Bool
}

enum ChipError: Error, Equatable {
    case invalid(String)
}

enum ChipModel {
    // A stack holds at most this many chips; more becomes another stack.
    static let maxStack = 12
    static let flyMs = 450.0
    static let allInMs = 700.0
    static let defaultDenominations = "casino 5000 1000 500 100 25 5 1"
    static let defaultColours = "casino"

    // Casino colours: 25 green, 100 black, 500 purple, 1000 orange, 5000 cream; small change grey.
    static let casino: [Int: ChipColour] = [
        5000: ChipColour(fill: "#f1e6c8", edge: "#b08a3c", ink: "#4a3a14"),
        1000: ChipColour(fill: "#e07b2a", edge: "#f6f1e4", ink: "#2b1a08"),
        500: ChipColour(fill: "#6e3fa0", edge: "#f6f1e4", ink: "#f6f1e4"),
        100: ChipColour(fill: "#1b1a17", edge: "#f6f1e4", ink: "#f6f1e4"),
        25: ChipColour(fill: "#2e8b57", edge: "#f6f1e4", ink: "#f6f1e4"),
        5: ChipColour(fill: "#c0262d", edge: "#f6f1e4", ink: "#f6f1e4"),
        1: ChipColour(fill: "#8a8f98", edge: "#f6f1e4", ink: "#1b1a17"),
    ]
    private static let spare = ["#2f6fb0", "#b0752f", "#7a3f6e", "#2f9aa0", "#8c8c2f", "#a03f3f"]

    // Installer values are one word then space separated entries, because an aepm string setting is
    // letters, digits, spaces and hyphens only. "casino 5000 1000 500 100 25 5 1": the first word
    // names the set and is optional.
    static func parseDenominations(_ value: String) throws -> [Int] {
        let words = value.split(whereSeparator: { $0 == " " || $0 == "," || $0 == "\n" || $0 == "\t" }).map(String.init)
        var numbers: [Int] = []
        for (i, w) in words.enumerated() {
            if i == 0, let c = w.first, c.isLetter { continue }
            guard let n = Int(w), n >= 1, String(n) == w else { throw ChipError.invalid("denomination must be a whole number above 0: \(w)") }
            numbers.append(n)
        }
        if numbers.isEmpty { throw ChipError.invalid("denominations must list at least one value") }
        if Set(numbers).count != numbers.count { throw ChipError.invalid("denominations must not repeat") }
        if !numbers.contains(1) { throw ChipError.invalid("denominations must include 1 so every amount can be made") }
        return numbers.sorted(by: >)
    }

    private static func channel(_ hex: String, _ at: Int) -> Double {
        let start = hex.index(hex.startIndex, offsetBy: at)
        return Double(Int(hex[start..<hex.index(start, offsetBy: 2)], radix: 16) ?? 0) / 255
    }

    // Text that can be read on a disc of this colour.
    static func inkFor(_ fill: String) -> String {
        0.2126 * channel(fill, 1) + 0.7152 * channel(fill, 3) + 0.0722 * channel(fill, 5) > 0.55 ? "#1b1a17" : "#f6f1e4"
    }

    // Colours for each denomination: the casino colours where the denomination has one, a spare colour
    // otherwise, and the caller's own ("mine 1000-e07b2a 25-2e8b57") on top.
    static func parseChipColours(_ value: String, denominations: [Int]) throws -> [Int: ChipColour] {
        var given: [Int: String] = [:]
        for (i, w) in value.split(separator: " ").map(String.init).enumerated() {
            if i == 0, w.allSatisfy({ $0.isLetter }) { continue }
            let parts = w.split(separator: "-", omittingEmptySubsequences: false).map(String.init)
            guard parts.count == 2, let d = Int(parts[0]), d >= 1, parts[1].count == 6, parts[1].allSatisfy({ $0.isHexDigit }) else {
                throw ChipError.invalid("chip colour must be denomination-rrggbb: \(w)")
            }
            given[d] = "#" + parts[1].lowercased()
        }
        var out: [Int: ChipColour] = [:]
        var next = 0
        for d in denominations.sorted(by: >) {
            if let fill = given[d] {
                out[d] = ChipColour(fill: fill, edge: "#f6f1e4", ink: inkFor(fill))
            } else if let base = casino[d] {
                out[d] = base
            } else {
                let fill = spare[next % spare.count]
                next += 1
                out[d] = ChipColour(fill: fill, edge: "#f6f1e4", ink: inkFor(fill))
            }
        }
        return out
    }

    // Greedy breakdown, largest first; a stack holds at most `maxStack` chips, more becomes another stack.
    static func breakdown(_ amount: Int, denominations: [Int], maxStack: Int = ChipModel.maxStack) -> [ChipStack] {
        var out: [ChipStack] = []
        var left = max(0, amount)
        for d in denominations.sorted(by: >) {
            var n = left / d
            left -= n * d
            while n > 0 {
                let c = min(n, maxStack)
                out.append(ChipStack(denom: d, count: c))
                n -= c
            }
        }
        return out
    }

    static func breakdown(_ amount: Int, setting: String = ChipModel.defaultDenominations) throws -> [ChipStack] {
        breakdown(amount, denominations: try parseDenominations(setting))
    }

    static func total(_ stacks: [ChipStack]) -> Int { stacks.reduce(0) { $0 + $1.denom * $1.count } }

    // 5000 is 5k, 1500 is 1.5k, small values are plain.
    static func shortDenom(_ d: Int) -> String {
        if d < 1000 { return String(d) }
        let k = Double(d) / 1000
        let rounded = (k * 10).rounded() / 10
        return rounded == rounded.rounded() ? "\(Int(rounded))k" : "\(rounded)k"
    }

    // Where each chip of a pile sits, top left origin, for chips of diameter `size`: stacks side by
    // side two units apart, each chip lifted a fifth of its size above the one below; only the top
    // chip of a stack carries its value, and only when the chip is large enough to read.
    static func pileLayout(_ stacks: [ChipStack], size: Double = 14) -> PileLayout {
        let lift = max(2, (size * 0.22).rounded())
        let maxCount = max(1, stacks.map(\.count).max() ?? 1)
        let height = size + Double(maxCount - 1) * lift
        var chips: [PlacedChip] = []
        for (i, s) in stacks.enumerated() {
            for k in 0..<s.count {
                chips.append(PlacedChip(stack: i, index: k, denom: s.denom, x: Double(i) * (size + 2), y: height - size - Double(k) * lift, label: k == s.count - 1 && size >= 14))
            }
        }
        return PileLayout(width: max(size, Double(stacks.count) * (size + 2)), height: height, lift: lift, chips: chips)
    }

    // ---- Movement ----

    private static func flight(_ key: String, _ from: ChipPoint, _ to: ChipPoint, _ amount: Int, _ start: Double, _ duration: Double, allIn: Bool = false) -> ChipFlight {
        ChipFlight(key: key, from: from, to: to, amount: amount, delayMs: start, durationMs: duration, endMs: start + duration, allIn: allIn)
    }

    // Each person's bet moves from in front of them to the pot at the same moment.
    static func sweepToPot(_ bets: [(id: String, amount: Int, from: ChipPoint)], pot: ChipPoint, startMs: Double = 0, flyMs: Double = ChipModel.flyMs) -> [ChipFlight] {
        bets.filter { $0.amount > 0 }.map { flight("pot:\($0.id)", $0.from, pot, $0.amount, startMs, flyMs) }
    }

    // Winnings move from the pot to each winner's stack at the same moment.
    static func awardPot(_ awards: [(id: String, amount: Int, to: ChipPoint)], pot: ChipPoint, startMs: Double = 0, flyMs: Double = ChipModel.flyMs) -> [ChipFlight] {
        awards.filter { $0.amount > 0 }.map { flight("stack:\($0.id)", pot, $0.to, $0.amount, startMs, flyMs) }
    }

    // What someone just put in: the rise from their previous bet to this one (all of it after a
    // sweep). An all in is slower and drawn larger.
    static func betFlight(id: String, previous: Int, bet: Int, sweptSince: Bool, seat: ChipPoint, spot: ChipPoint, allIn: Bool = false, startMs: Double = 0) -> ChipFlight? {
        let before = sweptSince ? 0 : previous
        guard bet > before else { return nil }
        return flight("bet:\(id)", seat, spot, bet - before, startMs, allIn ? allInMs : flyMs, allIn: allIn)
    }

    // The scale of the pulse of an all in as it flies: 1 at the ends, 1.5 half way.
    static func allInScale(_ progress: Double) -> Double { 1 + 0.5 * sin(min(1, max(0, progress)) * .pi) }

    // Position of a flying pile at progress 0 to 1 (eased in and out).
    static func flightAt(_ f: ChipFlight, _ progress: Double) -> ChipPoint {
        let p = min(1, max(0, progress))
        let e = p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p)
        return ChipPoint(x: f.from.x + (f.to.x - f.from.x) * e, y: f.from.y + (f.to.y - f.from.y) * e)
    }

    static func lastLanding(_ flights: [ChipFlight]) -> Double { flights.map(\.endMs).max() ?? 0 }
}
