import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import BookingWizard from './client/BookingWizard';
import Navbar from '@/components/layout/Navbar';
import LegalFooter from '@/components/layout/LegalFooter';
import { useAuth } from '@/context/AuthContext';
import { getStoredReferralAttribution } from '@/lib/referrals';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const GuestBookingPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const storedReferral = useMemo(() => getStoredReferralAttribution(), []);

  if (!isAuthenticated && storedReferral) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-10">
          <div className="container mx-auto px-4 flex justify-center">
            <Card variant="elevated" className="max-w-xl w-full">
              <CardContent className="p-8 space-y-4 text-center">
                <h1 className="text-2xl font-semibold text-foreground">Reserva con tu recompensa</h1>
                <p className="text-muted-foreground">
                  Para guardar tu recompensa necesitas crear una cuenta e iniciar sesión antes de reservar.
                </p>
                <div className="space-y-3">
                  <Button size="lg" variant="glow" className="w-full" asChild>
                    <Link to="/auth?tab=signup&redirect=/app/book">Crear cuenta y reservar</Link>
                  </Button>
                  <Button size="lg" variant="outline" className="w-full" asChild>
                    <Link to="/auth?redirect=/app/book">Ya tengo cuenta</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        <LegalFooter />
      </div>
    );
  }

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
