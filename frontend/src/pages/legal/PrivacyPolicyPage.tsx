import React from 'react';
import { getPrivacyPolicy } from '@/data/api';
import LegalPage from './LegalPage';

const PrivacyPolicyPage: React.FC = () => (
  <LegalPage loadPolicy={getPrivacyPolicy} />
);

export default PrivacyPolicyPage;
