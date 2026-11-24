"""Draws the PNG charts used in the MiceMax briefs.

Run: python make_charts.py   (needs matplotlib)
Every number below is copied from the briefs; see the source notes on each chart.
"""
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

OUT = Path(__file__).parent
SURFACE = "#fcfcfb"
TEXT = "#0b0b0b"
TEXT_2 = "#52514e"
MUTED = "#8a8984"
GRID = "#e6e5e1"
BLUE, ORANGE, AQUA = "#2a78d6", "#eb6834", "#1baf7a"
GRAY = "#b9b8b2"

plt.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Helvetica Neue", "Helvetica", "Arial", "DejaVu Sans"],
    "font.size": 11,
    "text.color": TEXT,
    "axes.labelcolor": TEXT_2,
    "xtick.color": TEXT_2,
    "ytick.color": TEXT_2,
})


def base(fig, ax, title, subtitle, source):
    fig.patch.set_facecolor(SURFACE)
    ax.set_facecolor(SURFACE)
    for s in ("top", "right", "left"):
        ax.spines[s].set_visible(False)
    ax.spines["bottom"].set_color(GRID)
    ax.tick_params(length=0)
    fig.text(0.04, 0.95, title, fontsize=15, fontweight="bold", va="top")
    fig.text(0.04, 0.875, subtitle, fontsize=11, color=TEXT_2, va="top")
    fig.text(0.04, 0.03, source, fontsize=8.5, color=MUTED)


def rounded_hbar(ax, x0, y, w, h, color):
    ax.add_patch(FancyBboxPatch((x0, y - h / 2), w, h, boxstyle="round,pad=0,rounding_size=0.06",
                                mutation_aspect=1, linewidth=2, edgecolor=SURFACE, facecolor=color))


# 0. Conference mix at Sapporo Convention Center (FY2025) -------------------
def chart_conference_mix():
    # Sapporo Convention Center FY2025 report (Apr 2025 - Mar 2026) [S28]
    types = [("Hokkaido-level meetings", 398, 110_064, GRAY),
             ("National meetings", 45, 45_856, BLUE),
             ("International meetings", 11, 27_806, ORANGE),
             ("Exhibitions", 110, 96_022, "#dcdbd6")]
    sizes = [("Up to 50", 47 + 132), ("51-100", 141), ("101-200", 87), ("201-500", 72),
             ("501-1,000", 41), ("Over 1,000", 30 + 11 + 3)]
    fig = plt.figure(figsize=(9, 7.4), dpi=200)
    fig.patch.set_facecolor(SURFACE)
    fig.text(0.04, 0.965, "A few national and international meetings bring the outside visitors",
             fontsize=15, fontweight="bold", va="top")
    fig.text(0.04, 0.925, "Sapporo Convention Center, FY2025: 564 events, 279,748 attendance",
             fontsize=11, color=TEXT_2, va="top")
    fig.text(0.04, 0.02, "Source: Sapporo Convention Center FY2025 operations report, Sapporo City [S28]. "
             "One venue only; the city-wide count is not split this way.", fontsize=8.5, color=MUTED)

    # top panel: share of events vs share of attendance
    ax = fig.add_axes([0.20, 0.60, 0.76, 0.24])
    ax.set_facecolor(SURFACE)
    for s in ax.spines.values():
        s.set_visible(False)
    ax.tick_params(length=0)
    rows = [("Events", 1), ("Attendance", 2)]
    for label, col in rows:
        y = 1 if label == "Events" else 0
        tot = sum(r[col] for r in types)
        x = 0
        for name, ev, att, c in types:
            v = (ev, att)[col - 1] / tot * 100
            ax.barh(y, v, left=x, height=0.62, color=c, edgecolor=SURFACE, linewidth=2)
            if v >= 6:
                ink = "white" if c in (BLUE, ORANGE) else TEXT
                ax.text(x + v / 2, y, f"{v:.0f}%", ha="center", va="center", fontsize=10.5,
                        color=ink, fontweight="bold")
            x += v
    ax.set_yticks([1, 0], ["Events", "Attendance"], fontsize=11)
    ax.set_xticks([])
    ax.set_xlim(0, 100)
    ax.set_ylim(-0.5, 1.5)
    # legend row under the bars
    handles = [plt.Rectangle((0, 0), 1, 1, color=c) for _, _, _, c in types]
    ax.legend(handles, [f"{n} ({e})" for n, e, _, _ in types], loc="upper center",
              bbox_to_anchor=(0.42, -0.08), ncol=2, frameon=False, fontsize=10, handlelength=1.2)

    # bottom panel: events by size
    ax2 = fig.add_axes([0.08, 0.10, 0.88, 0.30])
    ax2.set_facecolor(SURFACE)
    for s in ("top", "right", "left"):
        ax2.spines[s].set_visible(False)
    ax2.spines["bottom"].set_color(GRID)
    ax2.tick_params(length=0)
    xs = range(len(sizes))
    ax2.bar(xs, [v for _, v in sizes], width=0.6, color=BLUE, edgecolor=SURFACE, linewidth=2)
    for i, (_, v) in enumerate(sizes):
        ax2.text(i, v + 4, str(v), ha="center", va="bottom", fontsize=11, fontweight="bold")
    ax2.set_xticks(list(xs), [n for n, _ in sizes], fontsize=10.5)
    ax2.set_yticks([])
    ax2.set_ylim(0, 215)
    ax2.set_title("Events by number of people (all 564 events)", loc="left", fontsize=11.5, color=TEXT_2, pad=8)
    fig.savefig(OUT / "0-conference-mix.png", facecolor=SURFACE)
    plt.close(fig)


# 1. Who attends: one tall segmented bar ------------------------------------
def chart_attendees():
    total = 109_311
    parts = [("Japanese attendees", 102_605, BLUE),
             ("Overseas, Lions Clubs forum only", 3_599, ORANGE),
             ("Overseas, all other conferences", 3_107, AQUA)]
    fig, ax = plt.subplots(figsize=(9, 3.0), dpi=200)
    fig.subplots_adjust(left=0.04, right=0.96, top=0.70, bottom=0.16)
    base(fig, ax, "94% of Sapporo's conference attendees are Japanese",
         "109,311 attendees in 2025. Over half of the overseas attendees came to one event.",
         "Source: Sapporo City MICE statistics, 2025 [S1]. Shares derived.")
    x = 0
    for i, (label, v, c) in enumerate(parts):
        ax.barh(0, v, left=x, height=0.55, color=c, edgecolor=SURFACE, linewidth=2)
        pct = v / total * 100
        if i == 0:
            ax.text(x + v / 2, 0, f"{label}\n{v:,} ({pct:.0f}%)", ha="center", va="center",
                    color="white", fontsize=12, fontweight="bold")
        x += v
    # small overseas parts: labels below, with leader lines
    ax.annotate(f"Lions Clubs forum: {3_599:,} (3%)", xy=(102_605 + 1_800, -0.28), xytext=(70_000, -0.62),
                ha="left", va="center", fontsize=10.5, color=TEXT,
                arrowprops=dict(arrowstyle="-", color=MUTED, lw=1))
    ax.annotate(f"All other overseas: {3_107:,} (3%)", xy=(106_204 + 1_550, 0.28), xytext=(70_000, 0.62),
                ha="left", va="center", fontsize=10.5, color=TEXT,
                arrowprops=dict(arrowstyle="-", color=MUTED, lw=1))
    ax.set_xlim(0, total)
    ax.set_ylim(-0.8, 0.8)
    ax.set_yticks([])
    ax.set_xticks([])
    ax.spines["bottom"].set_visible(False)
    fig.savefig(OUT / "1-who-attends.png", facecolor=SURFACE)
    plt.close(fig)


# 2. Extra nights: two small panels, one per currency -----------------------
def chart_extra_nights():
    fig, axes = plt.subplots(1, 2, figsize=(9, 4.6), dpi=200)
    fig.subplots_adjust(left=0.06, right=0.97, top=0.70, bottom=0.20, wspace=0.35)
    base(fig, axes[0], "Attendees who stay extra nights spend far more",
         "Total trip spend per attendee, without vs with extra leisure nights",
         "Sources: Kyoto City MICE survey 2019, Japanese attendees at international conferences [S9]; "
         "VisitBritain 2024 [S10]. Comparisons, not proof of cause.")
    panels = [
        (axes[0], "Kyoto: Japanese attendees", ["No extra night", "Extra nights"], [47_136, 78_738], "¥{:,}", 95_000),
        (axes[1], "UK: all delegates", ["No extension", "Extended trip"], [714, 1_760], "£{:,}", 2_100),
    ]
    for ax, name, labels, vals, fmt, ymax in panels:
        ax.set_facecolor(SURFACE)
        for s in ("top", "right", "left"):
            ax.spines[s].set_visible(False)
        ax.spines["bottom"].set_color(GRID)
        ax.tick_params(length=0)
        bars = ax.bar([0, 1], vals, width=0.55, color=[GRAY, BLUE], edgecolor=SURFACE, linewidth=2)
        for b, v in zip(bars, vals):
            ax.text(b.get_x() + b.get_width() / 2, v + ymax * 0.02, fmt.format(v), ha="center", va="bottom",
                    fontsize=12, fontweight="bold", color=TEXT)
        ax.set_xticks([0, 1], labels, fontsize=10.5)
        ax.set_yticks([])
        ax.set_ylim(0, ymax)
        ax.set_title(name, fontsize=11.5, color=TEXT_2, loc="left", pad=6)
        ratio = vals[1] / vals[0]
        ax.text(1, vals[1] * 0.5, f"{ratio:.1f}×", ha="center", va="center", color="white",
                fontsize=12, fontweight="bold")
    fig.savefig(OUT / "2-extra-nights.png", facecolor=SURFACE)
    plt.close(fig)


# 3. Money model scenarios: stacked bars ------------------------------------
def chart_scenarios():
    names = ["Early", "Middle", "Strong"]
    nights = [2.0, 19.7, 91.8]
    acts = [1.5, 13.8, 80.3]
    totals = [3.4, 33.4, 172.2]  # exact totals from the scenario table (bar parts are rounded)
    fig, ax = plt.subplots(figsize=(9, 4.8), dpi=200)
    fig.subplots_adjust(left=0.06, right=0.80, top=0.72, bottom=0.17)
    base(fig, ax, "Extra nights bring in most of the new money",
         "Estimated new money for Sapporo per year, ¥ millions, by scenario",
         "All inputs except the 109,311 attendees are assumptions to test in a pilot. "
         "See 04-long-term-plan.md, money model.")
    x = range(3)
    ax.bar(x, nights, width=0.5, color=BLUE, edgecolor=SURFACE, linewidth=0.5, label="Extra nights")
    ax.bar(x, acts, width=0.5, bottom=nights, color=ORANGE, edgecolor=SURFACE, linewidth=1.5,
           label="Activities (only the share that is truly new)")
    for i in x:
        tot = totals[i]
        ax.text(i, nights[i] + acts[i] + 3, f"¥{tot:.1f}M", ha="center", va="bottom", fontsize=12, fontweight="bold")
    ax.set_xticks(list(x), names, fontsize=11)
    ax.set_ylim(0, 195)
    ax.set_yticks([0, 50, 100, 150])
    ax.yaxis.grid(True, color=GRID, linewidth=1)
    ax.set_axisbelow(True)
    # direct labels on the strong bar
    ax.text(2.3, nights[2] / 2, "Extra nights", va="center", fontsize=10.5, color=TEXT)
    ax.text(2.3, nights[2] + acts[2] / 2, "Activities\n(truly new share)", va="center", fontsize=10.5, color=TEXT)
    ax.legend(loc="upper left", frameon=False, fontsize=10)
    fig.savefig(OUT / "3-money-scenarios.png", facecolor=SURFACE)
    plt.close(fig)


if __name__ == "__main__":
    chart_conference_mix()
    chart_attendees()
    chart_extra_nights()
    chart_scenarios()
    print("charts written to", OUT)
