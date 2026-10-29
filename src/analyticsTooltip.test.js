import test from 'node:test';
import assert from 'node:assert/strict';
import {tooltipPoint} from './analyticsTooltip.js';

test('Analytics tooltip follows pointer in both axes', () => {
  assert.deepEqual(tooltipPoint(100,100,800,500,200,120),{left:116,top:116});
  assert.deepEqual(tooltipPoint(140,150,800,500,200,120),{left:156,top:166});
});
test('Analytics tooltip flips at chart edges and stays inside', () => {
  assert.deepEqual(tooltipPoint(790,490,800,500,200,120),{left:574,top:354});
  assert.deepEqual(tooltipPoint(0,0,220,140,200,120),{left:8,top:8});
});
