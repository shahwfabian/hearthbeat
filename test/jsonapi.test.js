import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexIncluded, relatedAttributes } from '../server/ring/jsonapi.js';

const doc = {
  data: [
    {
      type: 'devices',
      id: 'd1',
      attributes: { name: 'Front Door' },
      relationships: {
        status: { data: { type: 'device-status', id: 's1' }, links: { related: '/v1/devices/d1/status' } },
        location: { data: { type: 'locations', id: 'l1' }, links: { related: '/v1/devices/d1/location' } },
      },
    },
  ],
  included: [{ type: 'device-status', id: 's1', attributes: { online: true } }],
};

test('relatedAttributes resolves an included resource', () => {
  const index = indexIncluded(doc);
  assert.deepEqual(relatedAttributes(index, doc.data[0], 'status'), { online: true });
});

test('relatedAttributes returns null when the resource was not included', () => {
  const index = indexIncluded(doc);
  assert.equal(relatedAttributes(index, doc.data[0], 'location'), null);
  assert.equal(relatedAttributes(index, doc.data[0], 'nope'), null);
});

test('indexIncluded tolerates a document with no included array', () => {
  assert.equal(indexIncluded({ data: [] }).size, 0);
  assert.equal(indexIncluded(undefined).size, 0);
});
