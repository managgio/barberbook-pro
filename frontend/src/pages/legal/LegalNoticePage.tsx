import React from 'react';
import { getLegalNotice } from '@/data/api/legal';
import LegalPage from './LegalPage';

const LegalNoticePage: React.FC = () => (
  <LegalPage loadPolicy={getLegalNotice} />
);

export default LegalNoticePage;
