import React from 'react';
import BookingWizard from './client/BookingWizard';

const GuestBookingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background py-10">
      <div className="container mx-auto px-4">
        <BookingWizard isGuest />
      </div>
    </div>
  );
};

export default GuestBookingPage;
