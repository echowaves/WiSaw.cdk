## Why

Codacy is flagging a false positive security issue in tests/wave-lock-mode.js where fs.readFileSync is used with a path constructed from __dirname and a relative path. The issue incorrectly identifies this as a potential file path vulnerability when there is no user input involved in the path construction.

## What Changes

- Add appropriate ignore comment to suppress the false positive in Codacy/Opengrep analysis
- No functional changes to the codebase - only adds a comment to prevent incorrect security alerts

## Capabilities

### New Capabilities
None

### Modified Capabilities
None

## Impact

- File: tests/wave-lock-mode.js (lines 35-42)
- Adds a nosemgrep comment to suppress false positive security alert
- No impact on runtime behavior, dependencies, or APIs