package ae.chips

import ae.theme.ThemeSet
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import java.text.NumberFormat
import java.util.Locale

// What a pile needs from the application: its denominations and colours (installer settings).
class ChipStyle(
    val denominations: List<Int> = ChipModel.parseDenominations(ChipModel.DEFAULT_DENOMINATIONS),
    val colours: Map<Int, ChipColour> = ChipModel.parseChipColours(ChipModel.DEFAULT_COLOURS, ChipModel.parseDenominations(ChipModel.DEFAULT_DENOMINATIONS)),
    /** the theme's primary colour borders the amount label */
    val theme: ThemeSet = ThemeSet.named(null),
    /** how an amount is written under the pile; digits with thousands separators by default */
    val format: (Int) -> String = { NumberFormat.getIntegerInstance(Locale.US).format(it) },
) {
    companion object {
        // From the installer's two settings.
        fun of(denominations: String, chipColours: String, theme: ThemeSet = ThemeSet.named(null)): ChipStyle {
            val d = ChipModel.parseDenominations(denominations)
            return ChipStyle(d, ChipModel.parseChipColours(chipColours, d), theme)
        }
    }
}

val LocalChipStyle = compositionLocalOf { ChipStyle() }

private fun colour(hex: String): Color = Color(("FF" + hex.removePrefix("#")).toLong(16))

// A pile of stacks side by side with the amount under it. `size` is the chip diameter.
@Composable
fun ChipPile(amount: Int, size: Dp = 12.dp, label: Boolean = true, modifier: Modifier = Modifier) {
    val style = LocalChipStyle.current
    val layout = remember(amount, size, style.denominations) { ChipModel.pileLayout(ChipModel.breakdown(amount, style.denominations), size.value.toDouble()) }
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Canvas(Modifier.size(layout.width.dp, layout.height.dp)) {
            val d = size.toPx()
            val dash = PathEffect.dashPathEffect(floatArrayOf(d * 0.25f, d * 0.2f))
            val unit = density
            for (chip in layout.chips) {
                val c = style.colours[chip.denom] ?: ChipColour("#808080", "#f6f1e4", "#ffffff")
                val cx = (chip.x * unit).toFloat() + d / 2
                val cy = (chip.y * unit).toFloat() + d / 2
                drawCircle(Color.Black.copy(alpha = 0.35f), radius = d / 2, center = Offset(cx, cy + 1.5f))
                drawCircle(colour(c.fill), radius = d / 2, center = Offset(cx, cy))
                drawCircle(colour(c.edge), radius = d / 2 - 1.5f, center = Offset(cx, cy), style = Stroke(width = 2f, pathEffect = dash))
            }
        }
        if (label) Box(
            Modifier.padding(top = 1.dp).clip(RoundedCornerShape(10.dp)).background(Color.Black.copy(alpha = 0.6f))
                .border(1.dp, Color(style.theme.colour.primary), RoundedCornerShape(10.dp)).padding(horizontal = 6.dp),
        ) {
            Text(style.format(amount), color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
}

// Draws flights over an area `width` x `height` (spots are fractions of it). Each pile appears at
// its start after its delay, travels, and is removed; `onLand` runs as each one arrives.
@Composable
fun ChipFlightLayer(flights: List<ChipFlight>, chipSize: Dp = 12.dp, onLand: (ChipFlight) -> Unit = {}, modifier: Modifier = Modifier) {
    BoxWithConstraints(modifier.fillMaxSize()) {
        val done = remember { mutableStateListOf<String>() }
        for (f in flights) {
            if (f.key in done) continue
            val progress = remember(f) { Animatable(0f) }
            val visible = remember(f) { Animatable(0f) }
            LaunchedEffect(f) {
                if (f.delayMs > 0) delay(f.delayMs.toLong())
                visible.snapTo(1f)
                progress.animateTo(1f, tween(f.durationMs.toInt(), easing = LinearEasing))
                delay(40)
                done.add(f.key)
                onLand(f)
            }
            val p = ChipModel.flightAt(f, progress.value.toDouble())
            Box(
                Modifier.offset(maxWidth * p.x.toFloat(), maxHeight * p.y.toFloat())
                    .graphicsLayer { alpha = visible.value; val s = if (f.allIn) ChipModel.allInScale(progress.value.toDouble()).toFloat() else 1f; scaleX = s; scaleY = s },
            ) { ChipPile(f.amount, chipSize, label = false) }
        }
    }
}
