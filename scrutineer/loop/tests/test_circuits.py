"""The circuits have to be sound before anything measured on them means anything."""

import contextlib
import io

import pytest

from scrutineer.circuits import build_pool, split_pool
from scrutineer.evaluator import verify


@pytest.fixture(scope="module")
def pool():
    return build_pool()


def test_every_reference_solution_passes_its_hidden_tests(pool):
    for item in pool:
        with contextlib.redirect_stdout(io.StringIO()):
            exec(item.harness(item.reference_solution), {})  # noqa: S102


def test_every_item_has_a_verified_broken_variant(pool):
    for item in pool:
        assert item.broken_variants, f"{item.id} has no corruption that breaks it"


def test_no_broken_variant_passes_the_hidden_tests(pool):
    for item in pool[:40]:
        for name, src in item.broken_variants:
            assert not verify(item, src), f"{item.id}/{name} passes the tests it is meant to fail"


def test_split_is_deterministic_and_disjoint():
    a, b = split_pool(1994), split_pool(1994)
    assert [i.id for i in a.quali] == [i.id for i in b.quali]
    assert [i.id for i in a.sealed] == [i.id for i in b.sealed]
    ids = {i.id for i in a.quali} | {i.id for i in a.sealed} | {i.id for i in a.reserve}
    assert len(ids) == len(a.quali) + len(a.sealed) + len(a.reserve)
    assert not ({i.id for i in a.quali} & {i.id for i in a.sealed})


def test_visible_example_is_not_the_hidden_tests(pool):
    for item in pool[:20]:
        assert item.visible_example
        assert item.visible_example not in item.tests
