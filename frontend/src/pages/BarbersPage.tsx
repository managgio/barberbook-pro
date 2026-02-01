import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar';
import LegalFooter from '@/components/layout/LegalFooter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getBarbers } from '@/data/api';
import { Barber } from '@/data/types';
import { useAuth } from '@/context/AuthContext';
import { Calendar, Loader2 } from 'lucide-react';
import { CardSkeleton } from '@/components/common/Skeleton';
import defaultAvatar from '@/assets/img/default-image.webp';

const BarbersPage: React.FC = () => {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const fetchBarbers = async () => {
      const data = await getBarbers();
      setBarbers(data);
      setIsLoading(false);
    };
    fetchBarbers();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-24 pb-16">
        <div className="container px-4">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Nuestros <span className="text-gradient">barberos</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Conoce a los profesionales que harán realidad tu estilo. 
              Años de experiencia y pasión por el oficio.
            </p>
          </div>

          {/* Barbers Grid */}
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {[1, 2, 3, 4].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {barbers.map((barber, index) => (
                <Card 
                  key={barber.id} 
                  variant="elevated"
                  className="overflow-hidden animate-slide-up group"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="aspect-square relative overflow-hidden">
                    <img 
                      src={barber.photo || defaultAvatar} 
                      alt={barber.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <span className="text-xs text-foreground bg-primary/20 backdrop-blur-sm px-2 py-1 rounded-md">
                        {barber.role === 'admin' ? 'Senior' : 'Barbero'}
                      </span>
                    </div>
                  </div>
                  <CardContent className="p-6">
                    <h3 className="text-xl font-semibold text-foreground mb-1">{barber.name}</h3>
                    <p className="text-sm text-primary mb-3">{barber.specialty}</p>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{barber.bio}</p>
                    <Button className="w-full" asChild>
                      <Link to={isAuthenticated ? `/app/book?barber=${barber.id}` : '/auth'}>
                        <Calendar className="w-4 h-4 mr-2" />
                        Reservar con {barber.name.split(' ')[0]}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      <LegalFooter />
    </div>
  );
};

export default BarbersPage;
