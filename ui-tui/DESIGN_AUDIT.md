# Hermes TUI — UI/UX Design Audit

Senior designer review of the Ink terminal UI (`ui-tui/`).
Scope: layout, color, chat flow, information architecture, and interaction
patterns. Every finding references the real source so an engineer can act on
it directly.

---

## 1. What's working well

These are deliberate strengths — preserve them.

**Responsive banner ladder.** `branding.tsx:86-125` degrades
full ASCII art → compact rule → text → hidden across column thresholds
(34 / 58 / 52 / 64 / 46). This is the right model for terminal UI: every
layout has a graceful floor. Apply this pattern everywhere a component could
overflow.

**Progressive disclosure status bar.** `appChrome.tsx:256-268`
sheds segments in priority order (cost → bg → voice → compressions →
duration → context bar) as width narrows, with a separate compact-ctx
collapse below 72 cols. Excellent — the essentials (status + model) never
get crushed. This is best-in-class terminal responsive behavior.

**Four indicator styles.** `appChrome.tsx:47-76` gives users
kaomoji / emoji / ascii / unicode-braille. Personalization without code
changes. The `unicode` style correctly drops the verb rotation for users
who want minimal.

**Theme/skin pipeline.** `theme.ts` layers DARK/LIGHT defaults →
`fromSkin()` → ANSI-256 normalization for limited-color terminals. The
color math (`bestReadableAnsiColor`, luminance gating) is genuinely
thoughtful — most terminal apps skip this and look broken on Apple
Terminal / rxvt.

**Turn separators.** `appLayout.tsx:128-132` draws `───` between
user turns. Subtle, correct, aids scanning.

**Collapsible session panel.** `branding.tsx:161-418` with
collapse toggles (▾/▸) for Tools/Skills/MCP/System Prompt. Good
progressive disclosure of session metadata.

**Floating overlays.** `appOverlays.tsx:112-274` — completions,
model picker, session switcher, skills hub all render as
`position: absolute; bottom: 100%` float boxes anchored to the composer.
Clean pattern; doesn't disrupt transcript scroll.

---

## 2. Layout — structural issues

### 2.1 No persistent header / breadcrumb

**Problem.** The banner (`branding.tsx:86`) renders only inside
the transcript as an `intro` message row (`appLayout.tsx:134-136`). Once
you scroll, it's gone. There is no persistent identity line — you can't
tell at a glance which model, profile, or session you're in without
reading the status bar (which is busy and competes with activity).

**Recommendation.** Add an optional 1-line persistent header above
the transcript (config-gated: `display.tui_header`). Show: `⚕ Hermes ·
<model short> · <profile>`. Collapses to just the icon below 40 cols.
This mirrors what tmux users expect and gives immediate orientation on
resume/switch. The status bar already has this data — the header is for
*ambient* awareness, the status bar for *active* monitoring.

### 2.2 Transcript scrollbar gutter is inconsistent

**Problem.** `appLayout.tsx:184-186` renders a `TranscriptScrollbar`
in a `marginLeft={1}` gutter, but only the transcript pane has it. The
composer and prompt zone (`appLayout.tsx:459-471`) span full width
without the gutter. This creates a visual "step" where the transcript is
narrower than the composer — the right edge jumps left/right when
scrolling content hits the boundary.

**Recommendation.** Reserve the scrollbar gutter column across the
entire right edge (transcript + prompt + composer), or hide the scrollbar
entirely when not actively scrolling (fade on idle). The latter is
cleaner — see §4.2.

### 2.3 Composer is visually disconnected from transcript

**Problem.** There's a `marginTop={1}` gap and the `StatusRulePane`
between transcript and composer (`appLayout.tsx:292, 365`). The prompt
floats in space with no visual anchor tying it to the conversation above.

**Recommendation.** Consider a subtle top-border or faint separator
rule on the composer pane when the status bar is at the bottom — gives
the input a "docked" feel without adding chrome. When status bar is at
top (current toggle), the composer is the last element and this is less
critical.

---

## 3. Color & contrast

### 3.1 Muted color too close to label

**Problem.** Dark theme: `muted = #CC9B1F`, `label = #DAA520`
(`theme.ts:260, 271`). These are both amber-golds differing by ~6%
luminance. In dense output (tool results, session panel rows) the
hierarchy collapses — labels don't read as more important than body.

**Recommendation.** Push `label` brighter (toward `#FFD700`-ish
territory or a lighter amber `#E8B833`) OR push `muted` darker (toward
`#A8841B`). The semantic gap should be at least 15% luminance. The
comment at `theme.ts:261-265` says muted was bumped *up* for readability
— that fixed body-text legibility but broke the label/muted hierarchy.
Fix hierarchy by raising label, not by re-darkening muted.

### 3.2 Border color competes with content

**Problem.** `border = #CD7F32` (dark goldenrod) is saturated
enough that bordered boxes (SessionPanel, Panel, tool results) draw the
eye *more* than the content inside them. In a transcript with many tool
result boxes (`messageLine.tsx:110`), the borders create visual noise.

**Recommendation.** Desaturate the border for body-level boxes
(tool results, inline panels) and reserve the saturated border for
*primary* containers (SessionPanel, top-level Panel). Either add a
second `subtleBorder` theme key, or use `mix(border, 'transparent', 0.4)`
at the call site. The current single-border-for-everything flattens
hierarchy.

### 3.3 Light theme completion bg lacks contrast with current

**Problem.** `LIGHT_THEME.completionCurrentBg = mix('#F5F5F5',
'#A0651C', 0.25)` (`theme.ts:315`) — that's a 25% mix, yielding a very
pale amber on near-white. On bright monitors the selected completion row
barely differs from unselected.

**Recommendation.** Bump the mix to 0.35-0.40 for light theme, or
use a distinct hue (a pale blue `#E3EEF7` reads as "selection" without
clashing with the amber palette). Selection state must be unambiguous.

### 3.4 Error/warn too similar on limited-color terminals

**Problem.** `error = #ef5350`, `warn = #ffa726` (`theme.ts:274-273`).
After ANSI-256 normalization on Apple Terminal, both can collapse to
similar red/orange buckets. The `ok` green is fine, but error vs warn is
the most safety-critical distinction (approval prompts, failures).

**Recommendation.** In `normalizeAnsiForeground`, ensure error and
warn map to *different* 256-color buckets by at least 2 steps. Consider
giving error a dedicated normalization floor (never let it drift toward
orange).

---

## 4. Interaction & flow

### 4.1 `?` help hint is undiscoverable

**Problem.** Typing `?` as the first character shows the HelpHint
(`appLayout.tsx:306`). But there's no indication this exists — no
placeholder hint, no status bar mention. Users who don't type `?` first
never find it.

**Recommendation.** When the input is empty and idle (not busy),
append a faint `  ·  type ? for help` to the placeholder text
(`PLACEHOLDER` in `content/placeholders.ts`). Rotating it with
`/help for commands` (already in PLACEHOLDER) would surface both paths.

### 4.2 Scrollbar always visible

**Problem.** `TranscriptScrollbar` (`appLayout.tsx:185`) is always
rendered. In long sessions it's useful, but in short sessions (under a
screen of content) it's dead chrome.

**Recommendation.** Hide the scrollbar when content fits the
viewport (no overflow). Fade it in only when `virtualHistory.topSpacer > 0
|| bottomSpacer > 0`. This also fixes §2.2's gutter inconsistency for
short sessions.

### 4.3 Turn separator is only above user messages

**Problem.** `appLayout.tsx:128-132` adds `───` only above
subsequent user messages. Assistant responses have no visual delimiter.
In long assistant turns with many tool calls, it's hard to see where one
response ends and the next begins, especially after compression.

**Recommendation.** Consider a faint trailing rule or a
right-aligned `⤴ end of turn` marker after the final assistant message
of each turn (gated behind `display.turn_markers` config). Alternative:
extend the turn-separator to wrap the whole turn (user + assistant +
tools) as a unit.

### 4.4 Approval prompt keyboard hints are invisible

**Problem.** `ApprovalPrompt` (`prompts.tsx:69`) supports number
keys 1-4 and ↑/↓ (`approvalAction` at `prompts.tsx:38-67`), but the
rendered options (per the component, lines 81+) don't show the number
shortcuts. Users resort to arrow keys.

**Recommendation.** Prefix each option label with its number:
`[1] Allow once  [2] Allow this session  [3] Always allow  [4] Deny`.
This matches the `approvalAction` number-key dispatch and teaches the
shortcut inline.

### 4.5 Background task count is a bare text line

**Problem.** `appLayout.tsx:274-278` renders `"{n} background tasks
running"` as plain muted text above the composer. Easy to miss; no
indication of which tasks or their status.

**Recommendation.** Make it clickable (open the agents overlay
`/agents`), add a `⚡` or `◐` glyph, and show count in the accent color
when >0. This connects the ambient indicator to the detailed view.

---

## 5. Information architecture

### 5.1 Session panel shows too much by default

**Problem.** `SessionPanel` (`branding.tsx:161`) opens with
Tools expanded by default (`toolsOpen = true`, line 172). On a fresh
session this immediately floods the panel with every toolset. Skills,
MCP, and System Prompt are collapsed — inconsistent defaulting.

**Recommendation.** Collapse Tools by default too (change `true` →
`false`). Show only the summary line (`{toolsTotal} tools · {skillsTotal}
skills · {mcpConnected} MCP` at line 391-396) + model/cwd/session.
Users who want detail expand. This mirrors the "progressive disclosure"
philosophy already applied to the status bar.

### 5.2 Status bar has too many segments competing

**Problem.** `StatusRule` (`appChrome.tsx:405`) can show: status
indicator, model, context bar, context readout, duration, compressions,
voice, session count, bg count, subagents, cost, notice. Even with
progressive disclosure, at ≥92 cols *everything* renders and it becomes
a wall of text.

**Recommendation.** Group into zones with visual separators:
`[status · model] │ [context] │ [runtime: duration/comp/bg/subagents] │
[cwd]`. Use a stronger separator (`│` in border color) between zones and
`·` (muted) within zones. This gives the eye parseable chunks instead of
a flat token stream.

### 5.3 No model/profile switch affordance in the chrome

**Problem.** Model and profile are displayed in the status bar
and session panel, but switching requires typing `/model` or opening the
floating model picker. There's no click/hint affordance.

**Recommendation.** Make the model label in the status bar
clickable (when mouse tracking is on) to open the model picker overlay.
Add a `⌃` or `↻` glyph hint next to it. If mouse is off, show
`(M to switch)` in the status bar on first session.

---

## 6. Visual polish

### 6.1 Tool result boxes have inconsistent left margin

**Problem.** `messageLine.tsx:110` uses `marginLeft={3}` for tool
results, but `messageLine.tsx:79` (ToolTrail wrapper) has no margin, and
the trail's internal tree rows (`thinking.tsx:54-55`) use their own
`treeLead` indentation. The result is tool calls and their results don't
visually align — calls sit at column 0, results indent to column 3.

**Recommendation.** Align tool results under their corresponding
tool call in the trail. If the trail uses `├─ `/`└─ ` tree leads
(`thinking.tsx:55`), the result box's left margin should match the
lead's width + 2, not a flat 3.

### 6.2 Pet pane right-alignment can collide with content

**Problem.** `appLayout.tsx:37-50` renders the pet right-aligned
(`justifyContent="flex-end"`) full-width above the composer. On narrow
terminals the pet sprite can overlap or shove the prompt.

**Recommendation.** Cap pet pane width to the sprite's actual
width + padding, not `100%`. Or position it absolute in the
composer's right gutter (where `GoodVibesHeart` already lives,
`appLayout.tsx:355-357`).

### 6.3 Streaming text has no cursor/insertion indicator

**Problem.** `StreamingAssistant` (`streamingAssistant.tsx:24`)
appends text to the transcript but there's no visual "typing" cursor at
the insertion point. During long pauses between token deltas, it looks
frozen.

**Recommendation.** Append a blinking `▋` or `▍` block cursor at
the end of the streaming text, synced to the braille spinner interval.
Hide it when streaming completes. This is the standard terminal
convention for "still typing."

### 6.4 GoodVibesHeart is invisible to most users

**Problem.** `GoodVibesHeart` (`appChrome.tsx:380`) only renders
on a `tick > 0` for 650ms in a random color. It's an easter egg with no
onboarding. Charming but wasted if nobody knows it's there.

**Recommendation.** Keep it as an easter egg, but consider a
one-time hint on first session: a faint `♥ good vibes enabled` in the
status bar that fades after 5 seconds. Documents the feature without
cluttering.

---

## 7. Accessibility & robustness

### 7.1 No high-contrast / accessibility theme

**Problem.** There's DARK and LIGHT, but no high-contrast option
for users with low vision. The gold-on-dark palette can be hard to read
for some users.

**Recommendation.** Add a `HIGH_CONTRAST_THEME` variant: pure
white text, pure cyan/yellow accents, no dim/muted differentiation (use
bold instead of color for hierarchy). Gate via `HERMES_TUI_THEME=hc` in
`detectLightMode` (`theme.ts:412`).

### 7.2 Color is the only hierarchy signal in several places

**Problem.** Session panel rows (`branding.tsx:211-213`,
`237-240`) distinguish label from value only by color (`muted` vs
`text`). If color is unavailable (mono terminal, colorblind user), the
label runs into the value.

**Recommendation.** The `label: value` colon syntax is already
there — good. Also apply `bold` to labels so there's a non-color
hierarchy signal. Same for `Panel` rows (`branding.tsx:437-441`) where
`k.padEnd(20)` + color is the only separation.

### 7.3 Spinner tick rates can cause screen-reader / refresh issues

**Problem.** `FaceTicker` (`appChrome.tsx:119`) runs 3 intervals
(glyph, clock, verb) and the unicode style can tick at ~80ms
(`appChrome.tsx:75`). On slow terminals (SSH over high latency) this
causes flicker and floods the render queue.

**Recommendation.** Detect high-latency connections (round-trip
time on stdin events) and auto-degrade: cap spinner tick to 250ms, or
switch to `ascii` style automatically. Add a `display.minimal_spinner`
config override for users to opt in permanently.

---

## 8. Priority recommendations

Ranked by impact / effort:

| # | Finding | Impact | Effort | Where |
|---|---------|--------|--------|-------|
| 1 | §3.1 Label/muted hierarchy | High | Low | `theme.ts:260,271` |
| 2 | §5.1 Collapse Tools by default | High | Trivial | `branding.tsx:172` |
| 3 | §4.1 Surface `?` help hint | High | Low | `appLayout.tsx:306` |
| 4 | §4.2 Hide scrollbar when no overflow | Med | Med | `appLayout.tsx:184-186` |
| 5 | §2.1 Persistent header | High | Med | new component |
| 6 | §3.2 Desaturate body borders | Med | Low | `theme.ts` + call sites |
| 7 | §5.2 Status bar zone separators | Med | Low | `appChrome.tsx:480+` |
| 8 | §4.4 Number-key hints in approval | Med | Trivial | `prompts.tsx:81+` |
| 9 | §6.3 Streaming cursor | Med | Med | `streamingAssistant.tsx` |
| 10 | §6.1 Align tool result under call | Med | Med | `messageLine.tsx:110` |

Quick wins (trivial/low effort, ship first): #1, #2, #3, #8.
