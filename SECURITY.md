# Security Policy

## Reporting a Vulnerability

Please **do not** open public issues for security problems. Email
marcus@schuby.org with details and a way to reach you for follow-up.
Expect an acknowledgement within 7 days.

## Scope

This block authenticates to balenaCloud using `BALENA_API_KEY` injected
by balena at runtime. The block does not open network listeners and
reads no user-supplied configuration beyond the documented environment
variables.
