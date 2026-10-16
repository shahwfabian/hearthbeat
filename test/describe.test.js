import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeDoorway, describeInside, iconFor } from '../server/core/describe.js';

test('doorway wording is plain language', () => {
  assert.equal(describeDoorway({ kind: 'doorbell' }), 'Someone rang the doorbell');
  assert.equal(describeDoorway({ kind: 'motion', subType: 'human' }), 'Someone is at the door');
  assert.equal(describeDoorway({ kind: 'motion', subType: 'package_delivery' }), 'A package was delivered');
  assert.equal(describeDoorway({ kind: 'motion', subType: 'vehicle' }), 'A vehicle pulled up outside');
});

test('unknown sub types fall back to a safe sentence', () => {
  assert.equal(describeDoorway({ kind: 'motion', subType: 'brand_new_value' }), 'Movement outside');
  assert.equal(describeDoorway({ kind: 'motion' }), 'Movement outside');
});

test('inside wording names the room', () => {
  assert.equal(describeInside({ kind: 'motion' }, 'the kitchen'), 'Movement in the kitchen');
  assert.equal(describeInside({ kind: 'offline' }, 'The kitchen camera'), 'The kitchen camera went offline');
});

test('icons', () => {
  assert.equal(iconFor({ kind: 'doorbell' }, 'doorway'), 'bell');
  assert.equal(iconFor({ kind: 'motion', subType: 'package_delivery' }, 'doorway'), 'box');
  assert.equal(iconFor({ kind: 'motion' }, 'inside'), 'home');
  assert.equal(iconFor({ kind: 'offline' }, 'inside'), 'plug');
});
