import test from 'node:test';
import assert from 'node:assert/strict';
import { isSupportedNbaId } from '../src/lib/provider-id';

test('SportAPI player and team IDs are accepted', () => {
  assert.equal(isSupportedNbaId('sportapi:381'), true);
  assert.equal(isSupportedNbaId('sportapi:10'), true);
});

test('Legacy BALLDONTLIE records remain readable', () => {
  assert.equal(isSupportedNbaId('bdl:381'), true);
});

test('Malformed and non-provider identifiers are rejected', () => {
  for (const value of ['', '381', 'sportapi:0', 'sportapi:-1', 'sportapi:abc', 'SPORTAPI:381',
    'sportapi:381/other', 'sportapi:381?any=true', 'unknown:381', 'bdl:1;drop table', 'sportapi:99999999999999999']) {
    assert.equal(isSupportedNbaId(value), false, 'Unexpectedly accepted ' + value);
  }
});
