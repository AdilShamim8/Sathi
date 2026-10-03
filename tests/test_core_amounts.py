"""Amount parser cases: Bengali digits, number words, '30k', garbage, ambiguity."""

from core.amounts import parse_amount


def test_bengali_digits_with_hajar():
    r = parse_amount("৩০ হাজার")
    assert r.amount_paisa == 3_000_000 and not r.ambiguous


def test_bangla_words_with_hajar():
    r = parse_amount("ত্রিশ হাজার")
    assert r.amount_paisa == 3_000_000 and not r.ambiguous


def test_k_suffix():
    assert parse_amount("30k").amount_paisa == 3_000_000
    assert parse_amount("30K".lower()).amount_paisa == 3_000_000


def test_comma_grouping():
    assert parse_amount("30,000").amount_paisa == 3_000_000
    assert parse_amount("৩০,০০০").amount_paisa == 3_000_000


def test_lakh():
    assert parse_amount("৫ লাখ").amount_paisa == 50_000_000
    assert parse_amount("2 লাখ").amount_paisa == 20_000_000


def test_full_sentence():
    r = parse_amount("আমি ৬ মাসে ৩০ হাজার টাকা জমাতে চাই")
    assert r.amount_paisa == 3_000_000 and not r.ambiguous


def test_bare_small_number_is_ambiguous():
    # "30" could be ৳30 or ৳30,000: flag it, never guess.
    r = parse_amount("30")
    assert r.amount_paisa == 3_000 and r.ambiguous


def test_bare_word_is_ambiguous():
    r = parse_amount("ত্রিশ")
    assert r.amount_paisa == 3_000 and r.ambiguous


def test_taka_marker_disambiguates():
    r = parse_amount("৫০০ টাকা")
    assert r.amount_paisa == 50_000 and not r.ambiguous


def test_garbage():
    assert parse_amount("hello world").amount_paisa is None
    assert parse_amount("").amount_paisa is None
