package ae.chips

import kotlin.math.PI
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

// Chips as data: an amount becomes stacks of the application's denominations, drawn as discs with a
// dashed edge; bets move between spots on a schedule. Pure, no UI framework; matches web/chip-model.ts.
data class ChipPoint(val x: Double, val y: Double)
data class ChipColour(val fill: String, val edge: String, val ink: String)
data class ChipStack(val denom: Int, val count: Int)
data class PlacedChip(val stack: Int, val index: Int, val denom: Int, val x: Double, val y: Double, val label: Boolean)
data class PileLayout(val width: Double, val height: Double, val lift: Double, val chips: List<PlacedChip>)
data class ChipFlight(val key: String, val from: ChipPoint, val to: ChipPoint, val amount: Int, val delayMs: Double, val durationMs: Double, val endMs: Double, val allIn: Boolean)

object ChipModel {
    // A stack holds at most this many chips; more becomes another stack.
    const val MAX_STACK = 12
    const val FLY_MS = 450.0
    const val ALL_IN_MS = 700.0
    const val DEFAULT_DENOMINATIONS = "casino 5000 1000 500 100 25 5 1"
    const val DEFAULT_COLOURS = "casino"

    // Casino colours: 25 green, 100 black, 500 purple, 1000 orange, 5000 cream; small change grey.
    val CASINO: Map<Int, ChipColour> = mapOf(
        5000 to ChipColour("#f1e6c8", "#b08a3c", "#4a3a14"),
        1000 to ChipColour("#e07b2a", "#f6f1e4", "#2b1a08"),
        500 to ChipColour("#6e3fa0", "#f6f1e4", "#f6f1e4"),
        100 to ChipColour("#1b1a17", "#f6f1e4", "#f6f1e4"),
        25 to ChipColour("#2e8b57", "#f6f1e4", "#f6f1e4"),
        5 to ChipColour("#c0262d", "#f6f1e4", "#f6f1e4"),
        1 to ChipColour("#8a8f98", "#f6f1e4", "#1b1a17"),
    )
    private val SPARE = listOf("#2f6fb0", "#b0752f", "#7a3f6e", "#2f9aa0", "#8c8c2f", "#a03f3f")

    // Installer values are one word then space separated entries, because an aepm string setting is
    // letters, digits, spaces and hyphens only. "casino 5000 1000 500 100 25 5 1": the first word
    // names the set and is optional. Throws IllegalArgumentException for a bad value.
    fun parseDenominations(value: String): List<Int> {
        val words = value.trim().split(Regex("[\\s,]+")).filter { it.isNotEmpty() }
        val numbers = words.filterIndexed { i, w -> !(i == 0 && w[0].isLetter()) }.map { w ->
            require(Regex("[1-9][0-9]*").matches(w)) { "denomination must be a whole number above 0: $w" }
            w.toInt()
        }
        require(numbers.isNotEmpty()) { "denominations must list at least one value" }
        require(numbers.toSet().size == numbers.size) { "denominations must not repeat" }
        require(1 in numbers) { "denominations must include 1 so every amount can be made" }
        return numbers.sortedDescending()
    }

    private fun channel(hex: String, at: Int) = hex.substring(at, at + 2).toInt(16) / 255.0

    // Text that can be read on a disc of this colour.
    fun inkFor(fill: String): String = if (0.2126 * channel(fill, 1) + 0.7152 * channel(fill, 3) + 0.0722 * channel(fill, 5) > 0.55) "#1b1a17" else "#f6f1e4"

    // Colours for each denomination: the casino colours where the denomination has one, a spare colour
    // otherwise, and the caller's own ("mine 1000-e07b2a 25-2e8b57") on top.
    fun parseChipColours(value: String, denominations: List<Int>): Map<Int, ChipColour> {
        val given = mutableMapOf<Int, String>()
        value.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.forEachIndexed { i, w ->
            if (i == 0 && w.all { it.isLetter() }) return@forEachIndexed
            val m = Regex("([1-9][0-9]*)-([0-9a-fA-F]{6})").matchEntire(w)
            requireNotNull(m) { "chip colour must be denomination-rrggbb: $w" }
            given[m.groupValues[1].toInt()] = "#" + m.groupValues[2].lowercase()
        }
        val out = mutableMapOf<Int, ChipColour>()
        var next = 0
        for (d in denominations.sortedDescending()) {
            val own = given[d]
            out[d] = when {
                own != null -> ChipColour(own, "#f6f1e4", inkFor(own))
                CASINO[d] != null -> CASINO.getValue(d)
                else -> SPARE[next++ % SPARE.size].let { ChipColour(it, "#f6f1e4", inkFor(it)) }
            }
        }
        return out
    }

    // Greedy breakdown, largest first; a stack holds at most `maxStack` chips, more becomes another stack.
    fun breakdown(amount: Int, denominations: List<Int>, maxStack: Int = MAX_STACK): List<ChipStack> {
        val out = mutableListOf<ChipStack>()
        var left = max(0, amount)
        for (d in denominations.sortedDescending()) {
            var n = left / d
            left -= n * d
            while (n > 0) {
                val c = min(n, maxStack)
                out.add(ChipStack(d, c))
                n -= c
            }
        }
        return out
    }

    fun breakdown(amount: Int, setting: String = DEFAULT_DENOMINATIONS): List<ChipStack> = breakdown(amount, parseDenominations(setting))

    fun total(stacks: List<ChipStack>): Int = stacks.sumOf { it.denom * it.count }

    // 5000 is 5k, 1500 is 1.5k, small values are plain.
    fun shortDenom(d: Int): String {
        if (d < 1000) return d.toString()
        val k = d / 1000.0
        val rounded = (k * 10).roundToInt() / 10.0
        return if (rounded == Math.floor(rounded)) "${rounded.toInt()}k" else "${rounded}k"
    }

    // Where each chip of a pile sits, top left origin, for chips of diameter `size`: stacks side by
    // side two units apart, each chip lifted a fifth of its size above the one below; only the top
    // chip of a stack carries its value, and only when the chip is large enough to read.
    fun pileLayout(stacks: List<ChipStack>, size: Double = 14.0): PileLayout {
        val lift = max(2.0, Math.round(size * 0.22).toDouble())
        val maxCount = max(1, stacks.maxOfOrNull { it.count } ?: 1)
        val height = size + (maxCount - 1) * lift
        val chips = mutableListOf<PlacedChip>()
        stacks.forEachIndexed { i, s ->
            for (k in 0 until s.count) chips.add(PlacedChip(i, k, s.denom, i * (size + 2), height - size - k * lift, k == s.count - 1 && size >= 14))
        }
        return PileLayout(max(size, stacks.size * (size + 2)), height, lift, chips)
    }

    // ---- Movement ----

    private fun flight(key: String, from: ChipPoint, to: ChipPoint, amount: Int, start: Double, duration: Double, allIn: Boolean = false) =
        ChipFlight(key, from, to, amount, start, duration, start + duration, allIn)

    class Bet(val id: String, val amount: Int, val from: ChipPoint)
    class Award(val id: String, val amount: Int, val to: ChipPoint)

    // Each person's bet moves from in front of them to the pot at the same moment.
    fun sweepToPot(bets: List<Bet>, pot: ChipPoint, startMs: Double = 0.0, flyMs: Double = FLY_MS): List<ChipFlight> =
        bets.filter { it.amount > 0 }.map { flight("pot:${it.id}", it.from, pot, it.amount, startMs, flyMs) }

    // Winnings move from the pot to each winner's stack at the same moment.
    fun awardPot(awards: List<Award>, pot: ChipPoint, startMs: Double = 0.0, flyMs: Double = FLY_MS): List<ChipFlight> =
        awards.filter { it.amount > 0 }.map { flight("stack:${it.id}", pot, it.to, it.amount, startMs, flyMs) }

    // What someone just put in: the rise from their previous bet to this one (all of it after a
    // sweep). An all in is slower and drawn larger.
    fun betFlight(id: String, previous: Int, bet: Int, sweptSince: Boolean, seat: ChipPoint, spot: ChipPoint, allIn: Boolean = false, startMs: Double = 0.0): ChipFlight? {
        val before = if (sweptSince) 0 else previous
        if (bet <= before) return null
        return flight("bet:$id", seat, spot, bet - before, startMs, if (allIn) ALL_IN_MS else FLY_MS, allIn)
    }

    // The scale of the pulse of an all in as it flies: 1 at the ends, 1.5 half way.
    fun allInScale(progress: Double): Double = 1 + 0.5 * sin(progress.coerceIn(0.0, 1.0) * PI)

    // Position of a flying pile at progress 0 to 1 (eased in and out).
    fun flightAt(f: ChipFlight, progress: Double): ChipPoint {
        val p = progress.coerceIn(0.0, 1.0)
        val e = if (p < 0.5) 2 * p * p else 1 - 2 * (1 - p) * (1 - p)
        return ChipPoint(f.from.x + (f.to.x - f.from.x) * e, f.from.y + (f.to.y - f.from.y) * e)
    }

    fun lastLanding(flights: List<ChipFlight>): Double = flights.maxOfOrNull { it.endMs } ?: 0.0
}
