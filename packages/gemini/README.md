# Gemini Custom Agent

A REPL agent built on `@google/genai` function calling. Functionally identical
to the [`copilot`](../copilot/) package — same weather tool, same `tobias-info`
skill, same streaming chat loop — but rebuilt on Gemini.

## Run

```bash
GEMINI_API_KEY=… npm run gemini   # from repo root
```

## Structure

```
main.mts              REPL + streaming + tool/skill dispatch loop
log.mts               writes reasoning.log (skillInvoked / toolInvoked events)
tools/
  weatherTool.mts     get_weather tool (FunctionDeclaration + handler)
skills/
  loader.mts          scans skills/, parses frontmatter, builds the use_skill tool
  tobias-info/SKILL.md
```

## Why the extra files vs. copilot

The Copilot SDK ships batteries the Gemini SDK doesn't, so a few things Copilot
gets for free are hand-rolled here:

- **`skills/loader.mts`** — Copilot ingests skill directories natively: you pass
  `skillDirectories` and the SDK reads each `SKILL.md`'s frontmatter, advertises
  it to the model, and injects the body when the model picks it. Gemini has no
  skill concept at all. The loader replicates it client-side: parse each
  `SKILL.md` frontmatter, list the descriptions to the model, and expose a
  `use_skill` function the model calls to pull a skill's body on demand.

- **The tool loop in `main.mts`** — Copilot's `sendAndWait` runs tool calls
  internally and returns the final answer. With Gemini you drive the loop
  yourself: stream → collect `functionCalls` → run handlers → send
  `functionResponse` back → repeat until the model emits text.

In short: Copilot hides the tool/skill plumbing inside its SDK; with the raw
Gemini SDK that plumbing is ours to write, which is what these files are.
