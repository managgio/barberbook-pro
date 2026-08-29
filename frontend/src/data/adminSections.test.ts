import { describe, expect, it } from 'vitest';

import { ADMIN_REQUIRED_SECTIONS, isAdminSectionDefaultVisible } from './adminSections';

describe('admin sidebar sections', () => {
  it('keeps delivery incidents enabled by default but allows Platform to hide them', () => {
    expect(isAdminSectionDefaultVisible('email-deliveries')).toBe(true);
    expect(ADMIN_REQUIRED_SECTIONS).not.toContain('email-deliveries');
  });
});
