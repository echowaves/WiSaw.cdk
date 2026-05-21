---
name: openspec-propose
description: Propose a new change with all artifacts generated in one step. Use when the user wants to quickly describe what they want to build and get a complete proposal with design, specs, and tasks ready for implementation.
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.3.1"
---

Propose a new change - create the change and generate all artifacts in one step.

I'll create a change with artifacts:
- proposal.md (what & why)
- design.md (how)
- tasks.md (implementation steps)

When ready to implement, run /opsx:apply

---

**Input**: The user's request should include a change name (kebab-case) OR a description of what they want to build.

**Steps**

1. **If no clear input provided, ask what they want to build**

   Use the **AskUserQuestion tool** (open-ended, no preset options) to ask:
   > "What change do you want to work on? Describe what you want to build or fix."

   From their description, derive a kebab-case name (e.g., "add user authentication" → `add-user-auth`).

   **IMPORTANT**: Do NOT proceed without understanding what the user wants to build.

2. **Create the change directory**
   ```bash
   openspec new change "<name>"
   ```
   This creates a scaffolded change at `openspec/changes/<name>/` with `.openspec.yaml`.

3. **Get the artifact build order**
   ```bash
   openspec status --change "<name>" --json
   ```
   Parse the JSON to get:
   - `applyRequires`: array of artifact IDs needed before implementation (e.g., `["tasks"]`)
   - `artifacts`: list of all artifacts with their status and dependencies

4. **Create ONLY the proposal artifact**

   Use the **TodoWrite tool** to track progress through the artifacts.

   a. **Get instructions for the proposal**:
      ```bash
      openspec instructions proposal --change "<name>" --json
      ```
      The instructions JSON includes:
      - `context`: Project background (constraints for you - do NOT include in output)
      - `rules`: Artifact-specific rules (constraints for you - do NOT include in output)
      - `template`: The structure to use for your output file
      - `instruction`: Schema-specific guidance for this artifact type
      - `outputPath`: Where to write the artifact

   b. **Create the proposal file** using `template` as the structure:
      - Apply `context` and `rules` as constraints - but do NOT copy them into the file
      - Show brief progress: "Created proposal.md"

5. **Show final status**
   ```bash
   openspec status --change "<name>"
   ```

**Output**

After completing the proposal, summarize:
- Change name and location
- Brief description of what the proposal captures
- What's ready: "Proposal created."
- Prompt: "Run `/opsx:new <name>` to continue with design, specs, and tasks. Or run `/opsx:apply` when you're ready to implement."

**Artifact Creation Guidelines**

- Follow the `instruction` field from `openspec instructions` for each artifact type
- The schema defines what each artifact should contain - follow it
- Use `template` as the structure for your output file - fill in its sections
- **IMPORTANT**: `context` and `rules` are constraints for YOU, not content for the file
  - Do NOT copy `<context>`, `<rules>`, `<project_context>` blocks into the artifact
  - These guide what you write, but should never appear in the output

**Guardrails**
- Create ONLY the proposal artifact - do NOT auto-generate design, specs, or tasks
- Always read dependency artifacts before creating a new one
- If context is critically unclear, ask the user - but prefer making reasonable decisions to keep momentum
- If a change with that name already exists, ask if user wants to continue it or create a new one
- Verify each artifact file exists after writing before proceeding
- **Do NOT proceed to design/specs/tasks without explicit user request**
