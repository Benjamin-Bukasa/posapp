import test from 'node:test';
import assert from 'node:assert/strict';
import { getProductStatistics } from './productStatistics.js';

test('new tenant without products has zero counts', () => {
  assert.deepEqual(getProductStatistics([]), { total: 0, inStock: 0, lowStock: 0, outOfStock: 0 });
});

test('uses API availability including technical sheets and low-stock labels', () => {
  const products = [
    { quantity: 0, stock: 'Fiche technique manquante' },
    { quantity: 0, stock: 'Épuisé' },
    { quantity: -1, stock: 'Épuisé' },
    { quantity: 2, stock: 'Faible' },
    { quantity: 10, stock: 'En stock' },
  ];
  assert.deepEqual(getProductStatistics(products), { total: 5, inStock: 2, lowStock: 1, outOfStock: 3 });
});
