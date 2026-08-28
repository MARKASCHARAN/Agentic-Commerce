---
name: test-echo
description: Returns the supplied message unchanged.
requiredCapabilities: []
---

# Echo

## Description
Returns the supplied message unchanged.

## When to use
Used for testing the Skill Engine.

## Inputs
- message: string

## Outputs
- message: string

## Required capabilities

### Tools

None.

### Policy

None.

### Workflow

None.

## Validation
- message must be a non-empty string

## Safety
No external side effects.

## Failure handling
Invalid input must be rejected.

## Execution notes
This is a deterministic test skill.
