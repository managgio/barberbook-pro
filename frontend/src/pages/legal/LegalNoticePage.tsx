import React from 'react';
import { getLegalNotice } from '@/data/api';
import LegalPage from './LegalPage';

const LegalNoticePage: React.FC = () => (
  <LegalPage loadPolicy={getLegalNotice} />
);

export default LegalNoticePage;
