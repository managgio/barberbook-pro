import React from 'react';
import BookingWizard from './client/BookingWizard';
import Navbar from '@/components/layout/Navbar';
import LegalFooter from '@/components/layout/LegalFooter';

const GuestBookingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 pb-10">
        <div className="container mx-auto px-4">
          <BookingWizard isGuest />
        </div>
      </div>
      <LegalFooter />
    </div>
  );
};

export default GuestBookingPage;
