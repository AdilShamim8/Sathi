"""Seeded persona simulators and injected patterns for Sathi.

One numpy Generator, built from the config seed and passed down. Users are
generated in sorted id order. Same seed + same config => identical output
(invariant 10). All money is integer paisa; timestamps are UTC (aware).
"""
