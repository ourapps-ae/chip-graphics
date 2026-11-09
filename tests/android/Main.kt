import ae.chips.*
import kotlin.math.abs

// Mirrors tests/apple/main.swift: breakdowns and layouts are compared with rows the TypeScript produced (Expected.kt).
fun check(condition: Boolean, message: String) { if (!condition) { System.err.println("FAIL: $message"); System.exit(1) } }
fun near(a: Double, b: Double, what: String) = check(abs(a - b) < 1e-9, "$what: $a vs $b")
fun refuses(value: String) = try { ChipModel.parseDenominations(value); false } catch (e: IllegalArgumentException) { true }

fun main() {
    check(ChipModel.parseDenominations("casino 5000 1000 500 100 25 5 1") == listOf(5000, 1000, 500, 100, 25, 5, 1), "casino set")
    check(ChipModel.parseDenominations("1 5 25") == listOf(25, 5, 1), "no name is allowed")
    check(refuses("casino 5 25") && refuses("casino 1 1 5") && refuses("casino 1 0") && refuses("casino 1 2.5") && refuses("casino") && refuses(""), "bad denominations are refused")
    for (row in EXPECTED_BREAKDOWNS) {
        val set = row[0] as String
        val amount = row[1] as Int
        val got = ChipModel.breakdown(amount, set)
        check(got.joinToString(" ") { "${it.denom}:${it.count}" } == row[2], "breakdown $set $amount")
        check(ChipModel.total(got) == amount, "total $amount")
    }
    check(ChipModel.breakdown(13, listOf(1)) == listOf(ChipStack(1, 12), ChipStack(1, 1)), "twelve to a stack")
    check(ChipModel.breakdown(-5, listOf(1)).isEmpty(), "no negative chips")
    val casino = listOf(5000, 1000, 500, 100, 25, 5, 1)
    for (row in EXPECTED_LAYOUTS) {
        val size = (row[0] as Int).toDouble()
        val got = ChipModel.pileLayout(ChipModel.breakdown(row[1] as Int, casino), size)
        near(got.width, row[2] as Double, "width"); near(got.height, row[3] as Double, "height")
        check(got.chips.size == row[4], "chip count")
        val chips = (row[5] as String).split(" ").filter { it.isNotEmpty() }
        check(chips.size == got.chips.size, "chip rows")
        chips.forEachIndexed { i, c ->
            val (x, y, label) = c.split(":")
            near(got.chips[i].x, x.toDouble(), "chip x"); near(got.chips[i].y, y.toDouble(), "chip y")
            check(got.chips[i].label == (label == "1"), "chip label")
        }
    }
    check(listOf(1, 25, 999, 1000, 1500, 5000).map { ChipModel.shortDenom(it) } == listOf("1", "25", "999", "1k", "1.5k", "5k"), "short")
    val colours = ChipModel.parseChipColours("mine 25-112233 7-ffffff", listOf(100, 25, 7, 1))
    check(colours.getValue(25) == ChipColour("#112233", "#f6f1e4", "#f6f1e4") && colours.getValue(7).ink == "#1b1a17" && colours.getValue(100) == ChipModel.CASINO.getValue(100), "colours")
    val sweep = ChipModel.sweepToPot(listOf(ChipModel.Bet("a", 50, ChipPoint(0.2, 0.4)), ChipModel.Bet("b", 0, ChipPoint(0.8, 0.4)), ChipModel.Bet("c", 25, ChipPoint(0.5, 0.7))), ChipPoint(0.5, 0.63), 100.0)
    check(sweep.map { it.key } == listOf("pot:a", "pot:c") && sweep.all { it.delayMs == 100.0 && it.endMs == 100.0 + ChipModel.FLY_MS }, "sweep")
    check(ChipModel.betFlight("a", 10, 30, false, ChipPoint(0.0, 0.0), ChipPoint(1.0, 1.0))?.amount == 20, "the rise only")
    check(ChipModel.betFlight("a", 10, 30, true, ChipPoint(0.0, 0.0), ChipPoint(1.0, 1.0))?.amount == 30, "all of it after a sweep")
    check(ChipModel.betFlight("a", 30, 30, false, ChipPoint(0.0, 0.0), ChipPoint(1.0, 1.0)) == null, "no rise, no flight")
    check(ChipModel.betFlight("a", 0, 900, false, ChipPoint(0.0, 0.0), ChipPoint(1.0, 1.0), allIn = true)!!.durationMs == ChipModel.ALL_IN_MS, "all in is slower")
    near(ChipModel.flightAt(sweep[0], 0.5).x, 0.35, "half way"); near(ChipModel.allInScale(0.5), 1.5, "all in scale")
    println("android chip checks passed (${EXPECTED_BREAKDOWNS.size} breakdowns, ${EXPECTED_LAYOUTS.size} layouts)")
}
