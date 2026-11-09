import Foundation

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data("FAIL: \(message)\n".utf8))
    exit(1)
}
func check(_ condition: Bool, _ message: @autoclosure () -> String) { if !condition { fail(message()) } }
func near(_ a: Double, _ b: Double, _ what: String) { check(abs(a - b) < 1e-9, "\(what): \(a) vs \(b)") }
func num(_ any: Any?) -> Double { (any as! NSNumber).doubleValue }

guard let data = FileManager.default.contents(atPath: "tests/fixtures/chips.json"), let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { fail("cannot read chips.json") }

// Settings.
for s in json["sets"] as! [[String: Any]] {
    check(try! ChipModel.parseDenominations(s["set"] as! String) == (s["denominations"] as! [Int]), "denominations \(s["set"]!)")
}
func refuses(_ value: String) -> Bool { (try? ChipModel.parseDenominations(value)) == nil }
check(refuses("casino 5 25") && refuses("casino 1 1 5") && refuses("casino 1 0") && refuses("casino 1 2.5") && refuses("casino") && refuses(""), "bad denominations are refused")
check((try? ChipModel.parseDenominations("1 5 25")) == [25, 5, 1], "no name is allowed")

// Breakdowns: every set and amount equals the TypeScript's, and adds back to the amount.
var breakdowns = 0
for b in json["breakdowns"] as! [[String: Any]] {
    let amount = b["amount"] as! Int
    let got = try! ChipModel.breakdown(amount, setting: b["set"] as! String)
    let expected = (b["stacks"] as! [[String: Int]]).map { ChipStack(denom: $0["denom"]!, count: $0["count"]!) }
    check(got == expected, "breakdown \(b["set"]!) \(amount)")
    check(ChipModel.total(got) == amount, "total \(amount)")
    breakdowns += 1
}
check(ChipModel.breakdown(13, denominations: [1]) == [ChipStack(denom: 1, count: 12), ChipStack(denom: 1, count: 1)], "twelve to a stack")
check(ChipModel.breakdown(-5, denominations: [1]).isEmpty, "no negative chips")

// Colours.
for c in json["colours"] as! [[String: Any]] {
    let got = try! ChipModel.parseChipColours(c["setting"] as! String, denominations: c["denoms"] as! [Int])
    for (key, value) in c["colours"] as! [String: [String: String]] {
        let d = Int(key)!
        check(got[d] == ChipColour(fill: value["fill"]!, edge: value["edge"]!, ink: value["ink"]!), "colour \(c["setting"]!) \(d)")
    }
}
check((try? ChipModel.parseChipColours("mine 25-zz", denominations: [25, 1])) == nil, "bad colour is refused")

// Layouts.
for l in json["layouts"] as! [[String: Any]] {
    let size = num(l["size"])
    let got = ChipModel.pileLayout(ChipModel.breakdown(l["amount"] as! Int, denominations: [5000, 1000, 500, 100, 25, 5, 1]), size: size)
    let e = l["layout"] as! [String: Any]
    near(got.width, num(e["width"]), "width"); near(got.height, num(e["height"]), "height"); near(got.lift, num(e["lift"]), "lift")
    let chips = e["chips"] as! [[String: Any]]
    check(got.chips.count == chips.count, "chip count")
    for (i, c) in chips.enumerated() {
        near(got.chips[i].x, num(c["x"]), "chip x"); near(got.chips[i].y, num(c["y"]), "chip y")
        check(got.chips[i].label == (c["label"] as! Bool) && got.chips[i].denom == (c["denom"] as! Int), "chip flags")
    }
}
for pair in json["short"] as! [[Any]] { check(ChipModel.shortDenom(pair[0] as! Int) == pair[1] as! String, "short \(pair[0])") }

// Movement.
let fl = json["flights"] as! [[String: Any]]
let sweep = ChipModel.sweepToPot([("a", 50, ChipPoint(x: 0.2, y: 0.4)), ("b", 0, ChipPoint(x: 0.8, y: 0.4)), ("c", 25, ChipPoint(x: 0.5, y: 0.7))], pot: ChipPoint(x: 0.5, y: 0.63), startMs: 100)
check(sweep.count == fl.count, "sweep count")
for (i, f) in fl.enumerated() {
    check(sweep[i].key == f["key"] as! String && sweep[i].amount == f["amount"] as! Int, "flight \(i)")
    near(sweep[i].delayMs, num(f["delayMs"]), "delay"); near(sweep[i].durationMs, num(f["durationMs"]), "duration"); near(sweep[i].endMs, num(f["endMs"]), "end")
}
for a in json["along"] as! [[String: Any]] {
    let p = num(a["progress"])
    let pt = a["point"] as! [String: Any]
    let got = ChipModel.flightAt(sweep[0], p)
    near(got.x, num(pt["x"]), "flight x"); near(got.y, num(pt["y"]), "flight y"); near(ChipModel.allInScale(p), num(a["scale"]), "all in scale")
}
check(ChipModel.betFlight(id: "a", previous: 10, bet: 30, sweptSince: false, seat: ChipPoint(x: 0, y: 0), spot: ChipPoint(x: 1, y: 1))?.amount == 20, "the rise only")
check(ChipModel.betFlight(id: "a", previous: 10, bet: 30, sweptSince: true, seat: ChipPoint(x: 0, y: 0), spot: ChipPoint(x: 1, y: 1))?.amount == 30, "all of it after a sweep")
check(ChipModel.betFlight(id: "a", previous: 30, bet: 30, sweptSince: false, seat: ChipPoint(x: 0, y: 0), spot: ChipPoint(x: 1, y: 1)) == nil, "no rise, no flight")
let allIn = ChipModel.betFlight(id: "a", previous: 0, bet: 900, sweptSince: false, seat: ChipPoint(x: 0, y: 0), spot: ChipPoint(x: 1, y: 1), allIn: true)!
check(allIn.allIn && allIn.durationMs == ChipModel.allInMs, "all in is slower")
check(ChipModel.lastLanding(sweep) == 100 + ChipModel.flyMs && ChipModel.lastLanding([]) == 0, "last landing")
check(ChipModel.awardPot([("a", 75, ChipPoint(x: 0.2, y: 0.4)), ("z", 0, ChipPoint(x: 0, y: 0))], pot: ChipPoint(x: 0.5, y: 0.5)).map(\.key) == ["stack:a"], "award")

print("\(breakdowns) breakdowns, \(sweep.count) flights matched the TypeScript model")
