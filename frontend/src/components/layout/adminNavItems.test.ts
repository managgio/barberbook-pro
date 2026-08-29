import { describe, expect, it } from 'vitest';

import { getAdminSectionDefinition } from '@/data/adminSections';
import { adminNavItems } from './adminNavItems';

describe('adminNavItems', () => {
  it('uses the canonical section label and translation key for every tenant navigation item', () => {
    adminNavItems.forEach((item) => {
      const section = getAdminSectionDefinition(item.section);
      expect(item.label).toBe(section.label);
      expect(item.labelKey).toBe(section.labelKey);
    });
  });

  it('keeps delivery incidents synchronized between Platform and tenant navigation', () => {
    const section = getAdminSectionDefinition('email-deliveries');
    const navItem = adminNavItems.find((item) => item.section === 'email-deliveries');

    expect(section.label).toBe('Incidencias de envíos');
    expect(navItem?.label).toBe(section.label);
    expect(navItem?.labelKey).toBe('admin.section.emailDeliveries.label');
  });
});
