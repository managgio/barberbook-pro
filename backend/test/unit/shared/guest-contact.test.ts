import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildLegacyGuestContact, parseGuestContact } from '@/shared/domain/guest-contact';

test('structured guest contact takes precedence and normalizes email', () => {
  const contact = parseGuestContact({
    guestEmail: ' Client@Example.COM ',
    guestPhone: ' +34 600 000 000 ',
    guestContact: 'legacy@example.test · +34 611 111 111',
  });

  assert.deepEqual(contact, { email: 'client@example.com', phone: '+34 600 000 000' });
  assert.equal(buildLegacyGuestContact(contact), 'client@example.com · +34 600 000 000');
});

test('legacy combined guest contact remains readable during migration', () => {
  assert.deepEqual(
    parseGuestContact({ guestContact: '+34 600 000 000 · guest@example.test' }),
    { email: 'guest@example.test', phone: '+34 600 000 000' },
  );
});
