## Context

Codacy's Opengrep tool is flagging a false positive security issue in tests/wave-lock-mode.js at lines 37-40 where fs.readFileSync is used with a path constructed from __dirname and a relative path to a test target file. The tool incorrectly identifies this as a potential file path vulnerability (CWE-22: Improper Limitation of a Pathname to a Restricted Directory) when there is actually no user input involved in the path construction.

The code in question is:
```typescript
describe('updateWave owner-only freeze mode contract', () => {
  it('keeps owner guard and handles freezeMode persistence paths', () => {
    const updatePath = path.resolve(__dirname, '../lambda-fns/controllers/waves/update.ts')
    const source = fs.readFileSync(updatePath, 'utf8')
    // ... assertions about the source content
  })
})
```

This is a legitimate testing pattern used to verify that implementation files contain expected code patterns. The path is constructed using only __dirname (the directory of the current test file) and a hardcoded relative path - there is no user input, request parameters, or any external influence on the path.

## Goals / Non-Goals

**Goals:**
- Suppress the false positive security alert from Codacy/Opengrep
- Maintain the existing test functionality
- Make the intent clear to future developers reviewing the code

**Non-Goals:**
- Change the test implementation or functionality
- Modify the actual source code being tested
- Introduce any runtime overhead or complexity

## Decisions

### Decision: Use nosemgrep comment to suppress false positive
**Considered alternatives:**
1. **Do nothing** - Leave the false positive in Codacy reports (rejected because it creates noise and may cause real issues to be overlooked)
2. **Modify the test to avoid fs.readFileSync** - Refactor to not read the file (rejected because this would weaken the test and make it less effective at verifying implementation)
3. **Add nosemgrep ignore comment** - Suppress the specific rule for this false positive (chosen because it preserves test effectiveness while eliminating noise)
4. **Update Codacy rule configuration** - Modify the rule to be smarter about detecting actual user input (rejected because it's project-specific and requires Codacy admin access)

**Chosen solution:** Add a nosemgrep comment above the flagged code to suppress the specific Opengrep rule that's triggering incorrectly.

### Decision: Use specific rule ID rather than blanket disable
**Considered alternatives:**
1. **// nosemgrep: all** - Disable all rules for the following line (rejected because it's overly broad and could hide real issues)
2. **// nosemgrep: audit.security.audit-dynamic-file-path.user-controlled-file-path** - Disable only the specific rule (chosen because it's precise and maintains other security checks)

**Chosen solution:** Use the specific rule ID to maintain maximum security coverage while fixing the false positive.

## Risks / Trade-offs

[Risk] Future developers might remove the ignore comment not understanding its purpose → Mitigation: The comment includes context about why it's needed (false positive) and references the specific test being verified.

[Risk] If the test code actually did incorporate user input in the future, the ignore comment would mask a real vulnerability → Mitigation: The pattern is very specific to this test's legitimate use case, and any actual user input in path construction would be obvious during code review.

## Open Questions

None - this is a straightforward false positive fix with clear solution.