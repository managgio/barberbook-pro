import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getAppointments, getServices, getBarbers, getAvailableSlots, createAppointment, getServiceCategories, getProductCategories, getProducts, getSiteSettings, getPrivacyConsentStatus, getLoyaltyPreview, getRewardsWallet, getStripeAvailability, createStripeCheckout } from '@/data/api';
import { Service, Barber, BookingState, User, ServiceCategory, AppliedOffer, Product, ProductCategory, LoyaltyPreview, RewardWalletSummary, Coupon, StripeAvailability } from '@/data/types';
import { 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Scissors,
  Clock,
  Loader2,
  CheckCircle,
  CreditCard,
} from 'lucide-react';
import { format, addDays, startOfDay, isSameDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, isSameMonth, isBefore, differenceInCalendarDays, isAfter, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CardSkeleton } from '@/components/common/Skeleton';
import AlertBanner from '@/components/common/AlertBanner';
import ProductSelector from '@/components/common/ProductSelector';
import LoyaltyProgressPanel from '@/components/common/LoyaltyProgressPanel';
import defaultAvatar from '@/assets/img/default-image.webp';
import { getStoredReferralAttribution, clearStoredReferralAttribution } from '@/lib/referrals';

const STEPS = ['Servicio', 'Barbero y horario', 'Confirmación'];

interface BookingWizardProps {
  isGuest?: boolean;
}

const BookingWizard: React.FC<BookingWizardProps> = ({ isGuest = false }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(0);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [categoriesEnabled, setCategoriesEnabled] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [productsEnabled, setProductsEnabled] = useState(false);
  const [clientPurchaseEnabled, setClientPurchaseEnabled] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Array<{ productId: string; quantity: number }>>([]);
  const [isProductsDialogOpen, setIsProductsDialogOpen] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loyaltyPreview, setLoyaltyPreview] = useState<LoyaltyPreview | null>(null);
  const [isLoyaltyLoading, setIsLoyaltyLoading] = useState(false);
  const [walletSummary, setWalletSummary] = useState<RewardWalletSummary | null>(null);
  const [useWalletBalance, setUseWalletBalance] = useState(false);
  const [selectedCouponId, setSelectedCouponId] = useState<string | null>(null);
  const [stripeAvailability, setStripeAvailability] = useState<StripeAvailability | null>(null);
  const [paymentOption, setPaymentOption] = useState<'local' | 'stripe'>('local');
  const [showSuccess, setShowSuccess] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [privacyConsentRequired, setPrivacyConsentRequired] = useState(true);

  const [booking, setBooking] = useState<BookingState>({
    serviceId: null,
    barberId: searchParams.get('barber') || null,
    dateTime: null,
  });
  const [guestInfo, setGuestInfo] = useState({ name: '', email: '', phone: '' });
  const [appointmentNote, setAppointmentNote] = useState('');
  const [selectBarber, setSelectBarber] = useState(true);
  const [preferenceInitialized, setPreferenceInitialized] = useState(false);
  const [slotsByBarber, setSlotsByBarber] = useState<Record<string, string[]>>({});
  const [barberWeeklyLoad, setBarberWeeklyLoad] = useState<Record<string, number>>({});
  const slotsRequestRef = useRef(0);
  const weeklyLoadRequestRef = useRef(0);

  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [visibleMonth, setVisibleMonth] = useState<Date>(startOfMonth(new Date()));
  const today = startOfDay(new Date());
  const allowProductSelection = !isGuest && Boolean(user?.id) && productsEnabled && clientPurchaseEnabled;

  const selectedProductsTotal = useMemo(() => {
    return selectedProducts.reduce((acc, item) => {
      const product = products.find((prod) => prod.id === item.productId);
      if (!product) return acc;
      const unitPrice = product.finalPrice ?? product.price;
      return acc + unitPrice * item.quantity;
    }, 0);
  }, [products, selectedProducts]);
  const selectedProductDetails = useMemo(
    () =>
      selectedProducts
        .map((item) => {
          const product = products.find((prod) => prod.id === item.productId);
          if (!product) return null;
          const unitPrice = product.finalPrice ?? product.price;
          return {
            id: product.id,
            name: product.name,
            imageUrl: product.imageUrl,
            quantity: item.quantity,
            unitPrice,
            total: unitPrice * item.quantity,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [products, selectedProducts],
  );

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [servicesData, barbersData, categoriesData, settingsData, productsData, productCategoriesData, stripeData] = await Promise.all([
          getServices(),
          getBarbers(),
          getServiceCategories(true),
          getSiteSettings(),
          getProducts('booking'),
          getProductCategories(true),
          getStripeAvailability().catch(() => null),
        ]);
        setServices(servicesData);
        setBarbers(barbersData);
        setServiceCategories(categoriesData);
        setCategoriesEnabled(settingsData.services.categoriesEnabled);
        setProductsEnabled(settingsData.products.enabled);
        setClientPurchaseEnabled(settingsData.products.clientPurchaseEnabled);
        setProducts(productsData);
        setProductCategories(productCategoriesData);
        if (stripeData) {
          setStripeAvailability(stripeData);
        } else {
          setStripeAvailability(null);
        }
      } catch (error) {
        toast({
          title: 'No pudimos cargar los servicios',
          description: 'Intenta de nuevo en unos segundos.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
        if (searchParams.get('barber')) {
          setCurrentStep(0); // Start at service selection
        }
      }
    };
    fetchData();
  }, [searchParams, toast]);

  useEffect(() => {
    const preselected = searchParams.get('product');
    if (!preselected || !allowProductSelection || products.length === 0) return;
    setSelectedProducts((prev) => {
      if (prev.some((item) => item.productId === preselected)) return prev;
      return [...prev, { productId: preselected, quantity: 1 }];
    });
  }, [allowProductSelection, products, searchParams]);

  useEffect(() => {
    if (!stripeAvailability?.enabled) {
      setPaymentOption('local');
    }
  }, [stripeAvailability?.enabled]);

  useEffect(() => {
    if (isGuest || !user?.id || !booking.serviceId) {
      setLoyaltyPreview(null);
      setIsLoyaltyLoading(false);
      return;
    }
    let isMounted = true;
    setIsLoyaltyLoading(true);
    getLoyaltyPreview(user.id, booking.serviceId)
      .then((data) => {
        if (isMounted) setLoyaltyPreview(data);
      })
      .catch(() => {
        if (isMounted) setLoyaltyPreview(null);
      })
      .finally(() => {
        if (isMounted) setIsLoyaltyLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [booking.serviceId, isGuest, user?.id]);

  useEffect(() => {
    if (isGuest) {
      setUseWalletBalance(false);
      setSelectedCouponId(null);
    }
  }, [isGuest]);

  useEffect(() => {
    if (isGuest || !user?.id) {
      setWalletSummary(null);
      return;
    }
    let isMounted = true;
    getRewardsWallet(user.id)
      .then((data) => {
        if (isMounted) setWalletSummary(data);
      })
      .catch(() => {
        if (isMounted) setWalletSummary(null);
      });
    return () => {
      isMounted = false;
    };
  }, [isGuest, user?.id]);

  useEffect(() => {
    if (isGuest || !user?.id) {
      setPrivacyConsentRequired(true);
      setPrivacyConsent(false);
      return;
    }
    let isMounted = true;
    const loadStatus = async () => {
      try {
        const status = await getPrivacyConsentStatus(user.id);
        if (!isMounted) return;
        setPrivacyConsentRequired(status.required);
        setPrivacyConsent(status.required ? false : true);
      } catch (error) {
        if (!isMounted) return;
        setPrivacyConsentRequired(true);
        setPrivacyConsent(false);
      }
    };
    loadStatus();
    return () => {
      isMounted = false;
    };
  }, [isGuest, user?.id]);

  useEffect(() => {
    if (preferenceInitialized) return;
    const barberParam = searchParams.get('barber');
    if (barberParam) {
      setSelectBarber(true);
      setPreferenceInitialized(true);
      return;
    }
    if (user) {
      setSelectBarber(user.prefersBarberSelection ?? true);
      setPreferenceInitialized(true);
      return;
    }
    if (isGuest) {
      setSelectBarber(true);
      setPreferenceInitialized(true);
    }
  }, [isGuest, preferenceInitialized, searchParams, user]);

  useEffect(() => {
    if (booking.barberId) {
      const stillActive = barbers.some(
        (barber) => barber.id === booking.barberId && barber.isActive !== false
      );
      if (!stillActive) {
        setBooking((prev) => ({ ...prev, barberId: null, dateTime: null }));
      }
    }
  }, [barbers, booking.barberId]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days: Date[] = [];
    let current = calendarStart;
    while (current <= calendarEnd) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  }, [visibleMonth]);

  const slotGroups = useMemo(() => {
    const morning: string[] = [];
    const afternoon: string[] = [];
    availableSlots.forEach((slot) => {
      const hour = parseInt(slot.split(':')[0], 10);
      if (hour < 14) {
        morning.push(slot);
      } else {
        afternoon.push(slot);
      }
    });
    return { morningSlots: morning, afternoonSlots: afternoon };
  }, [availableSlots]);

  const orderedCategories = useMemo(
    () =>
      [...serviceCategories].sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name),
      ),
    [serviceCategories],
  );

  const categorizedServices = useMemo(
    () =>
      orderedCategories.map((category) => ({
        ...category,
        services: services.filter((service) => service.categoryId === category.id),
      })),
    [orderedCategories, services],
  );

  const uncategorizedServices = useMemo(
    () => services.filter((service) => !service.categoryId),
    [services],
  );

  const getService = () => services.find(s => s.id === booking.serviceId);
  const getBarber = () => barbers.find(b => b.id === booking.barberId);
  const availableBarbers = useMemo(
    () => barbers.filter((barber) => barber.isActive !== false),
    [barbers],
  );
  const canPickSlots = selectBarber ? !!booking.barberId : true;
  const assignedBarber = useMemo(
    () => barbers.find((barber) => barber.id === booking.barberId) || null,
    [barbers, booking.barberId],
  );

  const fetchSlots = useCallback(async () => {
    if (!booking.serviceId) return;
    const requestId = ++slotsRequestRef.current;
    setIsSlotsLoading(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    try {
      if (selectBarber) {
        if (!booking.barberId) {
          if (requestId === slotsRequestRef.current) {
            setAvailableSlots([]);
            setSlotsByBarber({});
          }
          return;
        }
        const slots = await getAvailableSlots(booking.barberId, dateStr, {
          serviceId: booking.serviceId,
        });
        if (requestId !== slotsRequestRef.current) return;
        setAvailableSlots(slots);
        setSlotsByBarber({});
      } else {
        if (availableBarbers.length === 0) {
          if (requestId === slotsRequestRef.current) {
            setAvailableSlots([]);
            setSlotsByBarber({});
          }
          return;
        }
        const results = await Promise.all(
          availableBarbers.map((barber) =>
            getAvailableSlots(barber.id, dateStr, { serviceId: booking.serviceId }),
          ),
        );
        if (requestId !== slotsRequestRef.current) return;
        const nextMap: Record<string, string[]> = {};
        availableBarbers.forEach((barber, index) => {
          nextMap[barber.id] = results[index] || [];
        });
        const merged = Array.from(new Set(results.flat())).sort();
        setSlotsByBarber(nextMap);
        setAvailableSlots(merged);
      }
    } catch (error) {
      if (requestId === slotsRequestRef.current) {
        setAvailableSlots([]);
        setSlotsByBarber({});
      }
    } finally {
      if (requestId === slotsRequestRef.current) {
        setIsSlotsLoading(false);
      }
    }
  }, [availableBarbers, booking.barberId, booking.serviceId, selectedDate, selectBarber]);

  const fetchWeeklyLoad = useCallback(async () => {
    const requestId = ++weeklyLoadRequestRef.current;
    if (!booking.serviceId || availableBarbers.length === 0) {
      setBarberWeeklyLoad({});
      return;
    }
    try {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
      const appts = await getAppointments();
      const counts = availableBarbers.reduce<Record<string, number>>((acc, barber) => {
        acc[barber.id] = 0;
        return acc;
      }, {});
      appts.forEach((appointment) => {
        if (appointment.status === 'cancelled') return;
        const date = parseISO(appointment.startDateTime);
        if (!isWithinInterval(date, { start: weekStart, end: weekEnd })) return;
        if (counts[appointment.barberId] !== undefined) {
          counts[appointment.barberId] += 1;
        }
      });
      if (requestId !== weeklyLoadRequestRef.current) return;
      setBarberWeeklyLoad(counts);
    } catch (error) {
      if (requestId === weeklyLoadRequestRef.current) {
        setBarberWeeklyLoad({});
      }
    }
  }, [availableBarbers, booking.serviceId, selectedDate]);

  useEffect(() => {
    if (!booking.serviceId || currentStep !== 1) return;
    if (selectBarber && !booking.barberId) return;
    fetchSlots();
  }, [booking.barberId, booking.serviceId, selectedDate, currentStep, fetchSlots, selectBarber]);

  useEffect(() => {
    if (selectBarber || !booking.serviceId || currentStep !== 1) return;
    fetchWeeklyLoad();
  }, [selectBarber, booking.serviceId, selectedDate, currentStep, fetchWeeklyLoad]);

  const handleSelectService = (serviceId: string) => {
    setBooking({
      serviceId,
      barberId: null,
      dateTime: null,
    });
    setSelectedCouponId(null);
    setSelectedDate(today);
    setVisibleMonth(startOfMonth(today));
    setAvailableSlots([]);
    setSlotsByBarber({});
    setBarberWeeklyLoad({});
    setCurrentStep(1);
  };

  const renderServiceCard = (service: Service) => {
    const basePrice = service.price;
    const computedOfferPrice =
      service.finalPrice ??
      (service.appliedOffer
        ? service.appliedOffer.discountType === 'percentage'
          ? basePrice * Math.max(0, 1 - service.appliedOffer.discountValue / 100)
          : Math.max(0, basePrice - service.appliedOffer.discountValue)
        : undefined);
    const finalPrice = computedOfferPrice ?? basePrice;
    const hasOffer = finalPrice < basePrice - 0.001;
    const offerEnds = service.appliedOffer?.endDate ? new Date(service.appliedOffer.endDate) : null;
    const daysLeft = offerEnds ? differenceInCalendarDays(offerEnds, today) : null;
    return (
      <Card
        key={service.id}
        variant={booking.serviceId === service.id ? 'selected' : 'interactive'}
        className="cursor-pointer h-full shadow-sm"
        onClick={() => handleSelectService(service.id)}
      >
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Scissors className="w-5 h-5 text-primary" />
            </div>
            <div className="text-right space-y-1">
              {hasOffer && (
                <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-primary/10 text-primary text-[11px] border border-primary/30">
                  {service.appliedOffer?.name ?? 'Oferta'}
                </div>
              )}
              {hasOffer && <div className="text-xs line-through text-muted-foreground">{service.price}€</div>}
              <span className="text-xl font-bold text-primary">{finalPrice.toFixed(2)}€</span>
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground">{service.name}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">{service.description}</p>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {service.duration} min
            </div>
          </div>
          {hasOffer && service.appliedOffer && (
            <div className="text-xs bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 space-y-1">
              <div className="flex items-center gap-2 text-primary">
                {service.appliedOffer.name} · ahorras {service.appliedOffer.amountOff.toFixed(2)}€
              </div>
              {service.appliedOffer.endDate && (
                <div className="text-[11px] text-muted-foreground">
                  Válida hasta {format(offerEnds as Date, "d 'de' MMMM", { locale: es })}
                  {daysLeft !== null && daysLeft >= 0 ? ` (${daysLeft} día${daysLeft === 1 ? '' : 's'})` : ''}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const handleSelectBarber = (barberId: string) => {
    setBooking((prev) => ({
      ...prev,
      barberId,
      dateTime: null,
    }));
    setSelectedDate(today);
    setVisibleMonth(startOfMonth(today));
    setAvailableSlots([]);
    setSlotsByBarber({});
  };

  const handleBarberSelectionToggle = (checked: boolean) => {
    setSelectBarber(checked);
    setBooking((prev) => ({
      ...prev,
      barberId: checked ? prev.barberId : null,
      dateTime: null,
    }));
    setAvailableSlots([]);
    setSlotsByBarber({});
    if (checked) {
      setBarberWeeklyLoad({});
    }
  };

  const isOfferActiveOnDate = (offer?: AppliedOffer | null, date?: Date | null) => {
    if (!offer || !date) return false;
    const day = new Date(date);
    const start = offer.startDate ? new Date(offer.startDate) : null;
    const end = offer.endDate ? new Date(offer.endDate) : null;
    if (start) {
      start.setHours(0, 0, 0, 0);
      if (isBefore(day, start)) return false;
    }
    if (end) {
      end.setHours(23, 59, 59, 999);
      if (isAfter(day, end)) return false;
    }
    return true;
  };

  const selectedPricing = useMemo(() => {
    const service = getService();
    if (!service) return null;
    const basePrice = service.price;
    const referenceDate = booking.dateTime ? new Date(booking.dateTime) : selectedDate;
    const offerActive = isOfferActiveOnDate(service.appliedOffer, referenceDate);
    if (offerActive && service.appliedOffer) {
      const offer = service.appliedOffer;
      const discountValue = offer.discountType === 'percentage'
        ? basePrice * (offer.discountValue / 100)
        : offer.discountValue;
      const finalPrice = Math.max(0, basePrice - discountValue);
      return { basePrice, finalPrice, appliedOffer: offer, amountOff: basePrice - finalPrice };
    }
    return { basePrice, finalPrice: basePrice, appliedOffer: null, amountOff: 0 };
  }, [booking.dateTime, selectedDate, services, booking.serviceId]);

  const loyaltyEligible = Boolean(loyaltyPreview?.enabled && loyaltyPreview.program);
  const loyaltyFree = loyaltyEligible && Boolean(loyaltyPreview?.isFreeNext);
  const walletAvailable = walletSummary?.wallet.availableBalance ?? 0;

  const eligibleCoupons = useMemo(() => {
    if (!walletSummary?.coupons || !booking.serviceId) return [] as Coupon[];
    return walletSummary.coupons.filter((coupon) => {
      if (!coupon.isActive) return false;
      if (coupon.serviceId && coupon.serviceId !== booking.serviceId) return false;
      if (coupon.discountType === 'FREE_SERVICE' && coupon.serviceId && coupon.serviceId !== booking.serviceId) {
        return false;
      }
      return true;
    });
  }, [walletSummary?.coupons, booking.serviceId]);

  const selectedCoupon = useMemo(
    () => eligibleCoupons.find((coupon) => coupon.id === selectedCouponId) ?? null,
    [eligibleCoupons, selectedCouponId],
  );

  useEffect(() => {
    if (loyaltyFree && selectedCouponId) {
      setSelectedCouponId(null);
    }
  }, [loyaltyFree, selectedCouponId]);

  useEffect(() => {
    if (selectedCouponId && !selectedCoupon) {
      setSelectedCouponId(null);
    }
  }, [selectedCouponId, selectedCoupon]);

  useEffect(() => {
    if (walletAvailable <= 0 && useWalletBalance) {
      setUseWalletBalance(false);
    }
  }, [walletAvailable, useWalletBalance]);

  const couponDiscount = useMemo(() => {
    if (!selectedCoupon || !selectedPricing) return 0;
    if (loyaltyFree) return 0;
    const basePrice = selectedPricing.finalPrice;
    if (basePrice <= 0) return 0;
    if (selectedCoupon.discountType === 'FREE_SERVICE') return basePrice;
    if (selectedCoupon.discountType === 'PERCENT_DISCOUNT') {
      const value = Math.max(0, Number(selectedCoupon.discountValue ?? 0));
      return Math.min(basePrice, basePrice * (value / 100));
    }
    if (selectedCoupon.discountType === 'FIXED_DISCOUNT') {
      const value = Math.max(0, Number(selectedCoupon.discountValue ?? 0));
      return Math.min(basePrice, value);
    }
    return 0;
  }, [selectedCoupon, selectedPricing, loyaltyFree]);

  const serviceSubtotal = useMemo(() => {
    if (!selectedPricing) return 0;
    const base = loyaltyFree ? 0 : selectedPricing.finalPrice;
    return Math.max(0, base - couponDiscount);
  }, [selectedPricing, loyaltyFree, couponDiscount]);

  const totalBeforeWallet = useMemo(
    () => serviceSubtotal + selectedProductsTotal,
    [serviceSubtotal, selectedProductsTotal],
  );

  const walletAppliedAmount = useMemo(() => {
    if (!useWalletBalance) return 0;
    return Math.min(walletAvailable, totalBeforeWallet);
  }, [useWalletBalance, walletAvailable, totalBeforeWallet]);

  const totalFinal = useMemo(
    () => Math.max(0, totalBeforeWallet - walletAppliedAmount),
    [totalBeforeWallet, walletAppliedAmount],
  );

  const activeOffers = useMemo(() => {
    const refDate = selectedDate;
    const seen = new Map<string, AppliedOffer>();
    services.forEach((service) => {
      const offer = service.appliedOffer;
      const basePrice = service.price;
      const computedPrice =
        service.finalPrice ??
        (offer
          ? offer.discountType === 'percentage'
            ? basePrice * Math.max(0, 1 - offer.discountValue / 100)
            : Math.max(0, basePrice - offer.discountValue)
          : undefined);
      const finalPrice = computedPrice ?? basePrice;
      if (!offer || finalPrice >= basePrice - 0.001) return;
      if (!isOfferActiveOnDate(offer, refDate)) return;
      if (!seen.has(offer.id)) {
        seen.set(offer.id, offer);
      }
    });
    return Array.from(seen.values());
  }, [services, selectedDate]);

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return !!booking.serviceId;
      case 1:
        return !!(booking.barberId && booking.dateTime);
      case 2:
        return isGuest ? guestInfo.name.trim().length > 0 && guestInfo.email.trim().length > 0 : true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleConfirm = async () => {
    if (!booking.serviceId || !booking.barberId || !booking.dateTime) return;
    if (!isGuest && !user) return;
    if (isGuest && guestInfo.name.trim().length === 0) {
      toast({
        title: 'Falta tu nombre',
        description: 'Necesitamos un nombre para reservar la cita.',
        variant: 'destructive',
      });
      return;
    }
    if (isGuest && guestInfo.email.trim().length === 0) {
      toast({
        title: 'Falta tu correo',
        description: 'Necesitamos un correo electrónico para reservar la cita.',
        variant: 'destructive',
      });
      return;
    }
    if (privacyConsentRequired && !privacyConsent) {
      toast({
        title: 'Falta consentimiento',
        description: 'Debes aceptar la Política de Privacidad para continuar.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const guestContact = [guestInfo.email.trim(), guestInfo.phone.trim()].filter(Boolean).join(' · ');
      const userId = isGuest ? null : (user as User).id;
      const productsPayload = allowProductSelection ? selectedProducts : undefined;
      const storedReferral = getStoredReferralAttribution();
      const payload = {
        userId,
        serviceId: booking.serviceId,
        barberId: booking.barberId,
        startDateTime: booking.dateTime,
        status: 'scheduled',
        notes: appointmentNote.trim() ? appointmentNote.trim() : undefined,
        guestName: isGuest ? guestInfo.name.trim() : undefined,
        guestContact: isGuest ? (guestContact || undefined) : undefined,
        privacyConsentGiven: privacyConsentRequired ? privacyConsent : undefined,
        referralAttributionId: storedReferral?.id,
        appliedCouponId: selectedCouponId ?? undefined,
        useWallet: useWalletBalance || undefined,
        ...(productsPayload ? { products: productsPayload } : {}),
      };

      if (stripeAvailability?.enabled && paymentOption === 'stripe' && totalFinal > 0) {
        const checkout = await createStripeCheckout(payload);
        clearStoredReferralAttribution();
        if (checkout?.mode === 'exempt') {
          setShowSuccess(true);
          setTimeout(() => {
            toast({
              title: '¡Cita reservada!',
              description: isGuest
                ? 'Hemos registrado tu cita. Te contactaremos para confirmar cualquier detalle.'
                : 'Tu cita ha sido programada correctamente.',
            });
            if (isGuest) {
              navigate('/');
            } else {
              navigate('/app/appointments');
            }
          }, 1500);
          return;
        }
        if (checkout?.checkoutUrl) {
          window.location.href = checkout.checkoutUrl;
          return;
        }
        throw new Error('No se pudo iniciar el pago.');
      }

      await createAppointment(payload);

      setShowSuccess(true);
      clearStoredReferralAttribution();

      setTimeout(() => {
        toast({
          title: '¡Cita reservada!',
          description: isGuest
            ? 'Hemos registrado tu cita. Te contactaremos para confirmar cualquier detalle.'
            : 'Tu cita ha sido programada correctamente.',
        });
        if (isGuest) {
          navigate('/');
        } else {
          navigate('/app/appointments');
        }
      }, 2000);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo completar la reserva. Inténtalo de nuevo.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  };

  const selectTimeSlot = (slot: string) => {
    const [hours, minutes] = slot.split(':');
    const dateTime = new Date(selectedDate);
    dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    if (!selectBarber) {
      const eligibleBarbers = availableBarbers.filter((barber) =>
        slotsByBarber[barber.id]?.includes(slot),
      );
      if (eligibleBarbers.length === 0) {
        toast({
          title: 'No hay barberos disponibles',
          description: 'Elige otro horario para asignarte un barbero disponible.',
          variant: 'destructive',
        });
        return;
      }
      const chosen = [...eligibleBarbers].sort((a, b) => {
        const loadDiff = (barberWeeklyLoad[a.id] ?? 0) - (barberWeeklyLoad[b.id] ?? 0);
        if (loadDiff !== 0) return loadDiff;
        return a.name.localeCompare(b.name);
      })[0];
      setBooking((prev) => ({
        ...prev,
        barberId: chosen.id,
        dateTime: dateTime.toISOString(),
      }));
      return;
    }
    setBooking((prev) => ({ ...prev, dateTime: dateTime.toISOString() }));
  };

  // Success Animation
  if (showSuccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center animate-scale-in">
          <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">¡Reserva programada!</h2>
          <p className="text-muted-foreground">
            {isGuest
              ? 'Para cambios o cancelaciones, contáctanos directamente.'
              : 'Redirigiendo a tus citas...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Reservar cita</h1>
        <p className="text-muted-foreground mt-1">
          {isGuest ? 'Reserva como invitado sin necesidad de crear cuenta.' : 'Completa los pasos para reservar tu cita.'}
        </p>
      </div>

      {/* Alerts */}
      <AlertBanner />

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center">
              <div 
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300',
                  index < currentStep 
                    ? 'bg-primary text-primary-foreground' 
                    : index === currentStep
                    ? 'bg-primary text-primary-foreground shadow-glow'
                    : 'bg-secondary text-muted-foreground'
                )}
              >
                {index < currentStep ? <Check className="w-5 h-5" /> : index + 1}
              </div>
              <span className={cn(
                'text-xs mt-2 hidden sm:block',
                index <= currentStep ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {step}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={cn(
                'flex-1 h-0.5 mx-2',
                index < currentStep ? 'bg-primary' : 'bg-border'
              )} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <Card variant="elevated">
        <CardContent className="p-6">
          {/* Step 0: Select Service */}
          {currentStep === 0 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Elige tu servicio</h2>
                  <p className="text-sm text-muted-foreground">
                    Primero selecciona qué necesitas; después elegiremos profesional y horario.
                  </p>
                </div>
              </div>
              {activeOffers.length > 0 && (
                <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 space-y-2">
                  <p className="text-sm font-semibold text-primary flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Hay ofertas activas ahora mismo
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-primary">
                    {activeOffers.map((offer) => {
                      const hasDates = offer.startDate || offer.endDate;
                      const validity = hasDates
                        ? `${offer.startDate ? format(new Date(offer.startDate), "d MMM", { locale: es }) : 'Ya'} → ${offer.endDate ? format(new Date(offer.endDate), "d MMM", { locale: es }) : 'Sin límite'}`
                        : 'Por tiempo limitado';
                      return (
                        <span
                          key={offer.id}
                          className="px-3 py-1 rounded-full bg-primary/15 text-primary border border-primary/20"
                        >
                          {offer.name} · {validity}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              {isLoading ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
                </div>
              ) : categoriesEnabled && categorizedServices.length > 0 ? (
                <div className="space-y-4">
                  {categorizedServices.map((category) => (
                    <div
                      key={category.id}
                      className="rounded-3xl border border-border/60 bg-muted/30 p-4 sm:p-5 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">{category.name}</h3>
                          <p className="text-sm text-muted-foreground">{category.description || 'Servicios de esta familia'}</p>
                        </div>
                        <span className="px-3 py-1 rounded-full border border-border text-xs text-muted-foreground">
                          {category.services?.length ?? 0} servicios
                        </span>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {category.services?.map((service) => renderServiceCard(service))}
                      </div>
                    </div>
                  ))}
                  {uncategorizedServices.length > 0 && (
                    <div className="rounded-3xl border border-border/60 bg-muted/30 p-4 sm:p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Sin categoría</p>
                          <h3 className="text-lg font-semibold text-foreground">Otros servicios</h3>
                          <p className="text-sm text-muted-foreground">Aún no agrupados en una categoría.</p>
                        </div>
                        <span className="px-3 py-1 rounded-full border border-border text-xs text-muted-foreground">
                          {uncategorizedServices.length} servicios
                        </span>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {uncategorizedServices.map((service) => renderServiceCard(service))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {services.map((service) => renderServiceCard(service))}
                </div>
              )}
            </div>
          )}

          {/* Step 1: Select Barber & Schedule */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-1">
                    {selectBarber ? 'Elige tu barbero y horario' : 'Elige tu horario'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectBarber
                      ? 'Primero selecciona un estilista y después escoge el día y la hora que mejor te encaje.'
                      : 'Selecciona el día y la hora; asignaremos automáticamente a un barbero disponible.'}
                  </p>
                </div>
                <div className="flex items-center gap-3 rounded-full border border-border bg-secondary/40 px-4 py-2">
                  <span className="text-xs font-medium text-muted-foreground">Elegir barbero</span>
                  <Switch checked={selectBarber} onCheckedChange={handleBarberSelectionToggle} />
                </div>
              </div>

              {!selectBarber && (
                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
                  <p>
                    Barbero asignado: {!assignedBarber?.name ? 'A determinar' : ''}
                  </p>
                  {assignedBarber && booking.dateTime && (
                    <div className="mt-3 flex items-center gap-3 rounded-xl border border-border/60 bg-background/70 p-3 text-foreground">
                      <img
                        src={assignedBarber.photo || defaultAvatar}
                        alt={assignedBarber.name}
                        className="w-12 h-12 rounded-xl object-cover"
                      />
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Barbero asignado</p>
                        <p className="font-semibold text-foreground">{assignedBarber.name}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className={cn('grid gap-6', selectBarber && 'lg:grid-cols-[280px,1fr]')}>
                {selectBarber && (
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-muted-foreground">Selecciona a tu estilista preferido</p>
                    <div className="space-y-3 pr-1 max-h-[420px] overflow-y-auto">
                      {availableBarbers.length > 0 ? (
                        availableBarbers.map((barber) => (
                          <button
                            key={barber.id}
                            onClick={() => handleSelectBarber(barber.id)}
                            className={cn(
                              'w-full rounded-2xl border p-3 flex items-center gap-3 text-left transition-all',
                              booking.barberId === barber.id
                                ? 'border-primary bg-primary/5 shadow-glow'
                                : 'border-border bg-card hover:border-primary/40'
                            )}
                          >
                            <img 
                              src={barber.photo || defaultAvatar} 
                              alt={barber.name}
                              className="w-14 h-14 rounded-xl object-cover"
                            />
                            <div className="flex-1">
                              <p className="font-semibold text-foreground">{barber.name}</p>
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">{barber.specialty}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Disponible desde {new Date(barber.startDate).toLocaleDateString()}
                                {barber.endDate && ` · hasta ${new Date(barber.endDate).toLocaleDateString()}`}
                              </p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No hay barberos activos disponibles.</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-5 rounded-3xl border border-border bg-muted/5 p-3 sm:p-4">
                  {canPickSlots ? (
                    <>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-muted-foreground">Selecciona el día</p>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setVisibleMonth((prev) => subMonths(prev, 1))}
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <span className="text-sm font-semibold text-foreground capitalize">
                              {format(visibleMonth, "MMMM yyyy", { locale: es })}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setVisibleMonth((prev) => addMonths(prev, 1))}
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-muted-foreground">
                          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => (
                            <span key={day}>{day}</span>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1.5">
                          {calendarDays.map((date) => {
                            const isSelected = isSameDay(date, selectedDate);
                            const isCurrentMonth = isSameMonth(date, visibleMonth);
                            const isPast = isBefore(date, today);
                            return (
                              <button
                                key={date.toISOString()}
                                disabled={isPast}
                                onClick={() => {
                                  setSelectedDate(startOfDay(date));
                                  setBooking((prev) => ({
                                    ...prev,
                                    dateTime: null,
                                    barberId: selectBarber ? prev.barberId : null,
                                  }));
                                  setAvailableSlots([]);
                                  setSlotsByBarber({});
                                  setBarberWeeklyLoad({});
                                }}
                                className={cn(
                                  'rounded-lg px-0 py-1.5 text-center text-xs transition-all border flex flex-col items-center justify-center min-h-[52px]',
                                  isSelected
                                    ? 'bg-primary text-primary-foreground border-primary shadow-glow'
                                    : isPast
                                    ? 'bg-muted text-muted-foreground border-border/50 cursor-not-allowed opacity-60'
                                    : 'bg-card border-border hover:border-primary/40',
                                  !isCurrentMonth && 'opacity-50'
                                )}
                              >
                                <span className="text-[10px] uppercase">{format(date, 'EEE', { locale: es })}</span>
                                <span className="text-base font-semibold leading-none mt-0.5">{format(date, 'd')}</span>
                                <span className="text-[9px] text-muted-foreground mt-0.5">{format(date, 'MMM', { locale: es })}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-3">Horarios disponibles</p>
                        {isSlotsLoading ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                          </div>
                        ) : availableSlots.length > 0 ? (
                          <div className="space-y-4">
                            {slotGroups.morningSlots.length > 0 && (
                              <div>
                                <p className="text-xs uppercase text-muted-foreground mb-2 tracking-wide">Mañana</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                                  {slotGroups.morningSlots.map((slot) => {
                                    const [hours, minutes] = slot.split(':');
                                    const slotDate = new Date(selectedDate);
                                    slotDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                                    const isSelected = booking.dateTime === slotDate.toISOString();
                                    return (
                                      <button
                                        key={slot}
                                        onClick={() => selectTimeSlot(slot)}
                                        className={cn(
                                          'rounded-2xl px-3 py-2 text-sm font-semibold border transition-all',
                                          isSelected
                                            ? 'bg-primary text-primary-foreground border-primary shadow-glow'
                                            : 'bg-card border-border hover:border-primary/40'
                                        )}
                                      >
                                        {slot}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {slotGroups.afternoonSlots.length > 0 && (
                              <div>
                                <p className="text-xs uppercase text-muted-foreground mb-2 tracking-wide">Tarde</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                                  {slotGroups.afternoonSlots.map((slot) => {
                                    const [hours, minutes] = slot.split(':');
                                    const slotDate = new Date(selectedDate);
                                    slotDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                                    const isSelected = booking.dateTime === slotDate.toISOString();
                                    return (
                                      <button
                                        key={slot}
                                        onClick={() => selectTimeSlot(slot)}
                                        className={cn(
                                          'rounded-2xl px-3 py-2 text-sm font-semibold border transition-all',
                                          isSelected
                                            ? 'bg-primary text-primary-foreground border-primary shadow-glow'
                                            : 'bg-card border-border hover:border-primary/40'
                                        )}
                                      >
                                        {slot}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                            No hay horarios disponibles para este día
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-16 gap-3 text-muted-foreground">
                      <Calendar className="w-10 h-10" />
                      <p className="text-sm font-medium">Selecciona primero a un barbero para revisar su agenda.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Confirmation */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Confirma tu reserva</h2>
              
              <div className="bg-secondary/50 rounded-xl p-6 space-y-4">
                {/* Service */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Scissors className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Servicio</p>
                    <p className="font-semibold text-foreground">{getService()?.name}</p>
                  </div>
                  <div className="text-right">
                    {loyaltyFree ? (
                      <>
                        <div className="text-xs line-through text-muted-foreground">
                          {selectedPricing?.finalPrice.toFixed(2)}€
                        </div>
                        <div className="text-xl font-bold text-primary">
                          0.00€
                        </div>
                        <div className="text-[11px] text-primary">
                          Cita gratis por fidelización
                        </div>
                      </>
                    ) : selectedPricing?.appliedOffer ? (
                      <>
                        <div className="text-xs line-through text-muted-foreground">
                          {selectedPricing.basePrice.toFixed(2)}€
                        </div>
                        <div className="text-xl font-bold text-primary">
                          {selectedPricing.finalPrice.toFixed(2)}€
                        </div>
                        <div className="text-[11px] text-green-600">
                          Oferta activa ({selectedPricing.appliedOffer.name})
                        </div>
                      </>
                    ) : (
                      <span className="text-xl font-bold text-primary">
                        {selectedPricing?.finalPrice.toFixed(2)}€
                      </span>
                    )}
                    {selectedProductsTotal > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Total con productos: {totalBeforeWallet.toFixed(2)}€
                      </div>
                    )}
                    {couponDiscount > 0 && (
                      <div className="text-[11px] text-green-600 mt-1">
                        Cupón aplicado: -{couponDiscount.toFixed(2)}€
                      </div>
                    )}
                  </div>
                </div>
                {getService()?.appliedOffer && !selectedPricing?.appliedOffer && (
                  <div className="text-sm text-primary bg-primary/10 border border-primary/30 rounded-lg px-3 py-2">
                    La oferta "{getService()?.appliedOffer?.name}" no aplica para la fecha seleccionada. Se usará el precio estándar.
                  </div>
                )}
                {selectedPricing?.appliedOffer?.endDate && (
                  <div className="text-xs text-muted-foreground">
                    Precio promocional válido para citas hasta{' '}
                    {format(new Date(selectedPricing.appliedOffer.endDate), "d 'de' MMMM", { locale: es })}.
                  </div>
                )}

                {allowProductSelection && productsEnabled && (
                  <>
                    <hr className="border-border" />
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">Productos añadidos</p>
                          <p className="text-xs text-muted-foreground">
                            Puedes incluir productos en esta cita.
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">
                            Total productos: {selectedProductsTotal.toFixed(2)}€
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsProductsDialogOpen(true)}
                          >
                            {selectedProducts.length > 0 ? 'Editar productos' : 'Añadir productos'}
                          </Button>
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-3">
                        {selectedProductDetails.length > 0 ? (
                          <div className="space-y-3">
                            {selectedProductDetails.map((item) => (
                              <div key={item.id} className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-lg bg-muted/60 overflow-hidden flex items-center justify-center">
                                    {item.imageUrl ? (
                                      <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                                    ) : (
                                      <span className="text-[11px] text-muted-foreground">Sin foto</span>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-foreground">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {item.quantity} x {item.unitPrice.toFixed(2)}€
                                    </p>
                                  </div>
                                </div>
                                <span className="text-sm font-medium text-foreground">{item.total.toFixed(2)}€</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Sin productos añadidos.</p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {!isGuest && (walletAvailable > 0 || eligibleCoupons.length > 0) && (
                  <>
                    <hr className="border-border" />
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">Recompensas disponibles</p>
                        <p className="text-xs text-muted-foreground">
                          Aplica tu saldo o un cupón para reducir el total.
                        </p>
                      </div>
                      {walletAvailable > 0 && (
                        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">Usar saldo disponible</p>
                            <p className="text-xs text-muted-foreground">
                              Se aplicará automáticamente hasta cubrir el total.
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-sm font-semibold text-primary">
                              {walletAvailable.toFixed(2)}€
                            </span>
                            <Switch checked={useWalletBalance} onCheckedChange={setUseWalletBalance} />
                          </div>
                        </div>
                      )}
                      {eligibleCoupons.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-sm">Aplicar cupón</Label>
                          <Select
                            value={selectedCouponId ?? 'none'}
                            onValueChange={(value) => setSelectedCouponId(value === 'none' ? null : value)}
                            disabled={loyaltyFree}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Selecciona un cupón" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No usar cupón</SelectItem>
                              {eligibleCoupons.map((coupon) => (
                                <SelectItem key={coupon.id} value={coupon.id}>
                                  {coupon.discountType === 'FREE_SERVICE'
                                    ? 'Servicio gratis'
                                    : coupon.discountType === 'PERCENT_DISCOUNT'
                                    ? `${coupon.discountValue ?? 0}% descuento`
                                    : `${coupon.discountValue ?? 0}€ descuento`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {loyaltyFree && (
                            <p className="text-[11px] text-muted-foreground">
                              La cita ya es gratuita por fidelización.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {loyaltyEligible && loyaltyPreview?.program && loyaltyPreview.progress && (
                  <>
                    <hr className="border-border" />
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">Tu tarjeta de fidelización</p>
                          <p className="text-xs text-muted-foreground">
                            {loyaltyFree ? 'Esta cita cuenta como recompensa.' : 'Sigue acumulando visitas.'}
                          </p>
                        </div>
                        {isLoyaltyLoading && (
                          <span className="text-xs text-muted-foreground">Actualizando…</span>
                        )}
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                        <LoyaltyProgressPanel
                          program={loyaltyPreview.program}
                          progress={loyaltyPreview.progress}
                          variant="compact"
                        />
                      </div>
                    </div>
                  </>
                )}

                {stripeAvailability?.enabled && totalFinal > 0 && (
                  <>
                    <hr className="border-border" />
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">Forma de pago</p>
                        <p className="text-xs text-muted-foreground">
                          Elige cómo quieres pagar tu cita.
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setPaymentOption('stripe')}
                          className={cn(
                            'rounded-2xl border px-4 py-3 text-left transition-all',
                            paymentOption === 'stripe'
                              ? 'border-primary bg-primary/10 shadow-glow'
                              : 'border-border/70 bg-background hover:border-primary/40'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                              <CreditCard className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">Pagar ahora con tarjeta</p>
                              <p className="text-xs text-muted-foreground">Reserva confirmada al instante.</p>
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentOption('local')}
                          className={cn(
                            'rounded-2xl border px-4 py-3 text-left transition-all',
                            paymentOption === 'local'
                              ? 'border-primary bg-primary/10 shadow-glow'
                              : 'border-border/70 bg-background hover:border-primary/40'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center">
                              <CheckCircle className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">Pagar en el local</p>
                              <p className="text-xs text-muted-foreground">Pagarás el día de la cita.</p>
                            </div>
                          </div>
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Si pagas ahora, te enviaremos la confirmación inmediatamente.
                      </p>
                    </div>
                  </>
                )}

                {totalFinal <= 0 && (
                  <>
                    <hr className="border-border" />
                    <p className="text-xs text-muted-foreground">
                      Esta cita es gratuita, no necesitas realizar ningún pago.
                    </p>
                  </>
                )}

                <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Precio servicio</span>
                    <span className="font-medium text-foreground">{(loyaltyFree ? 0 : selectedPricing?.finalPrice ?? 0).toFixed(2)}€</span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Cupón aplicado</span>
                      <span className="font-medium text-green-600">-{couponDiscount.toFixed(2)}€</span>
                    </div>
                  )}
                  {selectedProductsTotal > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Productos</span>
                      <span className="font-medium text-foreground">{selectedProductsTotal.toFixed(2)}€</span>
                    </div>
                  )}
                  {walletAppliedAmount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Saldo aplicado:</span>
                      <span className="font-medium text-primary">-{walletAppliedAmount.toFixed(2)}€</span>
                    </div>
                  )}
                  <div className="border-t border-border/60 pt-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">Total:</span>
                    <span className="text-lg font-bold text-primary">{totalFinal.toFixed(2)}€</span>
                  </div>
                </div>

                <hr className="border-border" />

                {/* Barber */}
                <div className="flex items-center gap-4">
                  <img 
                    src={getBarber()?.photo || defaultAvatar} 
                    alt={getBarber()?.name}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                  <div>
                    <p className="text-sm text-muted-foreground">Barbero</p>
                    <p className="font-semibold text-foreground">{getBarber()?.name}</p>
                  </div>
                </div>

                <hr className="border-border" />

                {/* Date & Time */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fecha y hora</p>
                    <p className="font-semibold text-foreground">
                      {booking.dateTime && format(new Date(booking.dateTime), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
                    </p>
                  </div>
                </div>
                <hr className="border-border" />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="appointment-note">Comentario para la cita</Label>
                    <span className="text-xs text-muted-foreground">
                      {appointmentNote.length}/250
                    </span>
                  </div>
                  <Textarea
                    id="appointment-note"
                    placeholder="¿Algo que debamos tener en cuenta?"
                    maxLength={250}
                    value={appointmentNote}
                    onChange={(e) => setAppointmentNote(e.target.value)}
                    className="min-h-[110px] resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    El comentario lo verá tu barbero para preparar la cita.
                  </p>
                </div>

                <hr className="border-border" />

                {isGuest && (
                  <>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="guest-name">Tu nombre *</Label>
                        <Input
                          id="guest-name"
                          placeholder="Nombre y apellidos"
                          value={guestInfo.name}
                          onChange={(e) => setGuestInfo((prev) => ({ ...prev, name: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="guest-email">Correo *</Label>
                        <Input
                          id="guest-email"
                          type="email"
                          placeholder="nombre@email.com"
                          value={guestInfo.email}
                          onChange={(e) => setGuestInfo((prev) => ({ ...prev, email: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="guest-phone">Teléfono (opcional)</Label>
                      <Input
                        id="guest-phone"
                        type="tel"
                        placeholder="+34 600 000 000"
                        value={guestInfo.phone}
                        onChange={(e) => setGuestInfo((prev) => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Para cambios o cancelaciones, contacta directamente con el salón.
                    </p>
                    <hr className="border-border" />
                  </>
                )}

                {privacyConsentRequired && (
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="privacy-consent"
                      checked={privacyConsent}
                      onCheckedChange={(value) => setPrivacyConsent(Boolean(value))}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="privacy-consent" className="text-sm leading-5 text-foreground">
                        He leído y acepto la{' '}
                        <a
                          href="/legal/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline underline-offset-4"
                        >
                          Política de Privacidad
                        </a>
                        .
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Necesitamos tu consentimiento para gestionar la reserva.
                      </p>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        {currentStep > 0 && (
          <Button
            variant="outline"
            onClick={handleBack}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Atrás
          </Button>
        )}

        <div className={currentStep === 0 ? "ml-auto" : ""}>
          {currentStep < STEPS.length - 1 ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Siguiente
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button 
              variant="glow" 
              onClick={handleConfirm} 
              disabled={
                isSubmitting ||
                !privacyConsent ||
                (isGuest && (guestInfo.name.trim().length === 0 || guestInfo.email.trim().length === 0))
              }
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {stripeAvailability?.enabled && paymentOption === 'stripe' && totalFinal > 0
                ? 'Pagar ahora'
                : 'Confirmar reserva'}
            </Button>
          )}
        </div>
      </div>
      <Dialog open={isProductsDialogOpen} onOpenChange={setIsProductsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Seleccionar productos</DialogTitle>
            <DialogDescription>
              Busca y añade productos a tu cita. Solo se guardarán los seleccionados.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <ProductSelector
              products={products}
              categories={productCategories}
              selected={selectedProducts}
              onChange={setSelectedProducts}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setIsProductsDialogOpen(false)}>
              Listo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookingWizard;
