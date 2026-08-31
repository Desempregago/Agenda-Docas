import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashSecret, needsSecretMigration, verifySecret } from '../src/server/security';

describe('credential security', () => {
  it('hashes and verifies secrets without storing plaintext', () => {
    const hash = hashSecret('correct horse battery staple');
    assert.notEqual(hash, 'correct horse battery staple');
    assert.equal(verifySecret(hash, 'correct horse battery staple'), true);
    assert.equal(verifySecret(hash, 'wrong secret'), false);
  });

  it('supports one-time migration of legacy plaintext credentials', () => {
    assert.equal(verifySecret('legacy-pin', 'legacy-pin'), true);
    assert.equal(needsSecretMigration('legacy-pin'), true);
    assert.equal(needsSecretMigration(hashSecret('legacy-pin')), false);
  });
});
