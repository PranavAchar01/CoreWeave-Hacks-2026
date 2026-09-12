"""A diff that does not apply cleanly is a rejected proposal, not a silent edit."""

import pytest

from scrutineer.patchtool import PatchError, apply_diff, make_diff, touched_paths


def test_roundtrip():
    old, new = "a: 1\nb: 2\nc: 3\n", "a: 1\nb: 9\nc: 3\n"
    d = make_diff("f.yaml", old, new)
    assert apply_diff({"f.yaml": old}, d)["f.yaml"] == new
    assert touched_paths(d) == ["f.yaml"]


def test_content_mismatch_is_rejected():
    """The offset may drift; the content may not."""
    old, new = "a: 1\nb: 2\nc: 3\n", "a: 1\nb: 9\nc: 3\n"
    d = make_diff("f.yaml", old, new)
    with pytest.raises(PatchError, match="context not found"):
        apply_diff({"f.yaml": "a: 1\nb: 7\nc: 3\n"}, d)


def test_wrong_line_numbers_still_apply():
    """A model writing a diff by hand gets `@@ -a,b +c,d @@` wrong constantly. patch(1) searches
    for the context rather than trusting the offset, and so does this."""
    old = "x: 0\ny: 0\na: 1\nb: 2\nc: 3\n"
    d = make_diff("f.yaml", "a: 1\nb: 2\nc: 3\n", "a: 1\nb: 9\nc: 3\n")
    assert apply_diff({"f.yaml": old}, d)["f.yaml"] == "x: 0\ny: 0\na: 1\nb: 9\nc: 3\n"


def test_unknown_file_is_rejected():
    d = make_diff("f.yaml", "a\n", "b\n")
    with pytest.raises(PatchError, match="unknown file"):
        apply_diff({"other.yaml": "a\n"}, d)


def test_garbage_is_rejected():
    with pytest.raises(PatchError):
        apply_diff({}, "this is not a diff")
