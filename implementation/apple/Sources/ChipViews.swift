#if canImport(UIKit)
import SwiftUI

// What a pile needs from the application: its denominations and colours (installer settings).
struct ChipStyle {
    var denominations = (try? ChipModel.parseDenominations(ChipModel.defaultDenominations)) ?? [1]
    var colours = (try? ChipModel.parseChipColours(ChipModel.defaultColours, denominations: [5000, 1000, 500, 100, 25, 5, 1])) ?? [:]
    // The theme's primary colour borders the amount label; paper is the default chip edge.
    var theme = ThemeSet.named(nil)
    // How an amount is written under the pile; digits with thousands separators by default.
    var format: (Int) -> String = { formatAmount($0) }

    init() {}

    // From the installer's two settings.
    init(denominations setting: String, chipColours: String, theme: ThemeSet = .named(nil)) throws {
        denominations = try ChipModel.parseDenominations(setting)
        colours = try ChipModel.parseChipColours(chipColours, denominations: denominations)
        self.theme = theme
    }
}

private func formatAmount(_ n: Int) -> String {
    let f = NumberFormatter()
    f.numberStyle = .decimal
    f.locale = Locale(identifier: "en_US")
    return f.string(from: NSNumber(value: n)) ?? String(n)
}

private struct ChipStyleKey: EnvironmentKey {
    static let defaultValue = ChipStyle()
}

extension EnvironmentValues {
    var chipStyle: ChipStyle {
        get { self[ChipStyleKey.self] }
        set { self[ChipStyleKey.self] = newValue }
    }
}

extension View {
    func chipStyle(_ style: ChipStyle) -> some View { environment(\.chipStyle, style) }
}

private func color(_ hex: String) -> Color {
    let c = ThemeColour(hex: hex) ?? ThemeColour(rgba: 0x808080FF)
    return Color(c)
}

// A pile of stacks side by side with the amount under it. `size` is the chip diameter.
struct ChipPile: View {
    let amount: Int
    var size: CGFloat = 12
    var label = true
    var labelSize: CGFloat = 11
    @Environment(\.chipStyle) private var style

    var body: some View {
        let layout = ChipModel.pileLayout(ChipModel.breakdown(amount, denominations: style.denominations), size: Double(size))
        VStack(spacing: 1) {
            Canvas { ctx, _ in
                for chip in layout.chips {
                    let colours = style.colours[chip.denom] ?? ChipColour(fill: "#808080", edge: "#f6f1e4", ink: "#ffffff")
                    let rect = CGRect(x: chip.x, y: chip.y, width: Double(size), height: Double(size))
                    ctx.fill(Path(ellipseIn: rect.offsetBy(dx: 0, dy: 1.5)), with: .color(.black.opacity(0.35)))
                    ctx.fill(Path(ellipseIn: rect), with: .color(color(colours.fill)))
                    ctx.stroke(Path(ellipseIn: rect.insetBy(dx: 1.5, dy: 1.5)), with: .color(color(colours.edge)), style: StrokeStyle(lineWidth: 2, dash: [size * 0.25, size * 0.2]))
                    if chip.label {
                        ctx.draw(Text(ChipModel.shortDenom(chip.denom)).font(.system(size: size * 0.42, weight: .bold)).foregroundColor(color(colours.ink)), at: CGPoint(x: rect.midX, y: rect.midY))
                    }
                }
            }
            .frame(width: CGFloat(layout.width), height: CGFloat(layout.height))
            if label {
                Text(style.format(amount)).font(.system(size: labelSize, weight: .bold)).foregroundStyle(.white).padding(.horizontal, labelSize * 0.55)
                    .background(Color.black.opacity(0.6), in: Capsule()).overlay(Capsule().stroke(Color(style.theme.colour.primary), lineWidth: 1))
            }
        }
    }
}

// Pairs a flight with the screen points it travels between: the application converts the layout's
// spots (fractions of the table) to points.
struct ChipFlightLayer: View {
    let flights: [ChipFlight]
    let width: CGFloat
    let height: CGFloat
    var chipSize: CGFloat = 12
    var onLand: (ChipFlight) -> Void = { _ in }

    var body: some View {
        ZStack {
            ForEach(flights, id: \.key) { f in FlyingChips(f: f, width: width, height: height, chipSize: chipSize, onLand: onLand) }
        }
        .frame(width: width, height: height)
        .allowsHitTesting(false)
    }
}

private struct FlyingChips: View {
    let f: ChipFlight
    let width: CGFloat
    let height: CGFloat
    let chipSize: CGFloat
    let onLand: (ChipFlight) -> Void
    @State private var progress = 0.0
    @State private var visible = false

    var body: some View {
        let p = ChipModel.flightAt(f, progress)
        ChipPile(amount: f.amount, size: chipSize, label: false)
            .scaleEffect(f.allIn ? CGFloat(ChipModel.allInScale(progress)) : 1)
            .opacity(visible ? 1 : 0)
            .position(x: width * p.x, y: height * p.y)
            .task {
                if f.delayMs > 0 { try? await Task.sleep(nanoseconds: UInt64(f.delayMs * 1_000_000)) }
                visible = true
                withAnimation(.linear(duration: f.durationMs / 1000)) { progress = 1 }
                try? await Task.sleep(nanoseconds: UInt64((f.durationMs + 40) * 1_000_000))
                visible = false
                onLand(f)
            }
    }
}
#endif
