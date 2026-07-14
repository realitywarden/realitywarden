# Manual / PDF Import (v0.5)

RealityWarden can turn a text-bearing PDF, Markdown file, or plain-text device
manual into an **untrusted DeviceProfile and Action Manifest proposal** using
the local Ollama model. The workflow is available from **File → Import Device
Manual…**.

## Trust and execution boundary

- PDF parsing only extracts text. A scanned PDF without a text layer fails
  explicitly; there is no OCR guess or silent fallback.
- The complete extracted text, its SHA-256 digest, local model name, elapsed
  time, and raw model output are retained in the project audit record.
- Model output passes a strict schema. Unknown fields, cross-device
  capabilities, invalid limits, unknown primitives, targets, values, and
  action envelopes are rejected rather than repaired or clamped.
- A human must review the complete JSON and explicitly confirm it. Editing the
  JSON clears the confirmation and save performs the full validation again.
- Saved records force `supported_adapters: ["simulator"]`, conservative safety
  flags, `profile_source: "manual_import"`, and `simulation_only: true`.
- Manual imports do not register a real adapter, enable REAL HARDWARE, bypass
  the evidence lock, or gain an alternate actuation path.

The proposal is stored under `workspace.manual_imports` in the desktop project
file. Every stored record and proposed manifest is revalidated when the project
is loaded. A tampered record that adds any adapter other than `simulator` is
rejected in full and reported to the operator.
