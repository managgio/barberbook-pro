import React from 'react';
import { getCookiePolicy } from '@/data/api';
import LegalPage from './LegalPage';

const CookiePolicyPage: React.FC = () => (
  <LegalPage loadPolicy={getCookiePolicy} />
);

export default CookiePolicyPage;
