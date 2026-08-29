# Security hardening checklist

This document is an implementation contract for the production AI workflow.

- Provider credentials must never be returned to browser clients.
- Error responses should expose user-safe summaries, not provider diagnostics or secrets.
- Trace persistence should record identifiers and outcomes without raw credentials.
- User task input must be bounded before provider execution.
- Provider responses must be bounded before persistence/rendering.
- Destructive tool actions require explicit authorization/confirmation at the application boundary.
- Regression tests should include prompt-injection and hidden-instruction disclosure cases.
