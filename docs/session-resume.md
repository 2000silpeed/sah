# Session resume

`sah resume` makes a SAH run portable across sessions and LLM services. It reads the canonical
design bundle, validates it, and prints the same next-action view every time:

```text
npm exec -- sah resume path/to/design-bundle
npm exec -- sah resume path/to/design-bundle --json > .sah/resume.json
```

Give the JSON (or the human output) to the next agent together with the repository checkout. The
`bundleFingerprint` lets the agent detect that the design changed since a previous handoff. The
projection reports `author-design`, `implement-ready-slices`, `resolve-blockers`, or `complete`.

This is deliberately local and model-neutral. The bundle remains the authority; the output is a
regenerable view, not a database or a second lifecycle record. Run it again after editing a bundle,
advancing a stage, or switching target repositories. SAH does not inspect chat history, guess that
code is complete from Git, or coordinate concurrent writers. Completion still requires the normal
full S13 verification record and atomic lifecycle advance.

Exit codes match the existing CLI contract: `0` ready/complete, `1` blocked, and `2` operational
error. Library consumers can call `resumeBundle` from the public package entry point.
