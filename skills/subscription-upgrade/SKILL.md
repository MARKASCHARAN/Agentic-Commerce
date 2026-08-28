---
name: subscription-upgrade
description: Upgrade a buyer's subscription plan.
requiredCapabilities:
  - subscriptions
---

# Subscription Upgrade

## Purpose
Facilitate upgrading a buyer from their current subscription tier to a higher tier.

## When to use
Use when a buyer requests an upgrade or exhibits usage patterns that warrant a higher tier.

## Required capabilities
- subscriptions

## Inputs
- current plan
- target plan

## Rules
- Never bypass merchant policy.
- Never modify financial state directly.

## Expected output
Upgrade confirmation and next steps.
