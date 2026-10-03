"""LLM layer: sanitizer, tools, orchestrator, validator, templates.

The LLM routes intent and narrates results. It never computes money
(invariant 1) and no unvalidated text reaches the user (invariant 2).
"""
