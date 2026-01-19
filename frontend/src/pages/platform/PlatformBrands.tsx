import React, { useEffect, useMemo, useState } from 'react';
import {
  createPlatformBrand,
  createPlatformLocation,
  deletePlatformBrand,
  deletePlatformLocation,
  getPlatformBrandAdmins,
  getPlatformBrand,
  getPlatformBrandConfig,
  getPlatformBrands,
  getPlatformLocationConfig,
  getPlatformBrandLegalSettings,
  getPlatformBrandDpa,
  assignPlatformBrandAdmin,
  removePlatformBrandAdmin,
  updatePlatformBrand,
  updatePlatformBrandConfig,
  updatePlatformBrandLegalSettings,
  updatePlatformLocation,
  updatePlatformLocationConfig,
} from '@/data/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Building2, GripVertical, Image as ImageIcon, LayoutTemplate, Loader2, MapPin, Package, Plus, RefreshCcw, Save, Scissors, Settings2, Sparkles, Trash2, UserPlus, Users } from 'lucide-react';
import { deleteFromImageKit, uploadToImageKit } from '@/lib/imagekit';
import { ADMIN_REQUIRED_SECTIONS, ADMIN_SECTIONS } from '@/data/adminSections';
import { AdminSectionKey, LegalCustomSections, LegalPolicyResponse, LegalSettings, SubProcessor } from '@/data/types';
import MarkdownContent from '@/components/common/MarkdownContent';

const updateNestedValue = (source: Record<string, any>, path: string[], value: any) => {
  const result = { ...source };
  let cursor: Record<string, any> = result;
  path.forEach((key, index) => {
    if (index === path.length - 1) {
      cursor[key] = value;
      return;
    }
    cursor[key] = cursor[key] && typeof cursor[key] === 'object' ? { ...cursor[key] } : {};
    cursor = cursor[key];
  });
  return result;
};

const normalizeHexInput = (value: string) => {
  const raw = value.trim().toLowerCase();
  if (!raw) return '';
  return raw.startsWith('#') ? raw : `#${raw}`;
};

const stripEmptyTheme = <T extends Record<string, any>>(config: T): T => {
  if (!config || typeof config !== 'object') return config;
  const theme = config.theme;
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) return config;
  const primary = typeof theme.primary === 'string' ? theme.primary.trim() : '';
  if (primary) {
    if (primary === theme.primary) return config;
    return { ...config, theme: { ...theme, primary } };
  }
  const next = { ...config };
  const nextTheme = { ...theme };
  delete nextTheme.primary;
  if (Object.keys(nextTheme).length === 0) {
    delete next.theme;
  } else {
    next.theme = nextTheme;
  }
  return next;
};

const normalizeImagekitFolder = (value?: string, subdomain?: string | null) => {
  const normalized = value?.trim().replace(/^\/+|\/+$/g, '');
  if (!normalized) return '';
  if (!subdomain) return normalized;
  const marker = `${subdomain}/`;
  const index = normalized.indexOf(marker);
  if (index !== -1) {
    return normalized.slice(index + marker.length);
  }
  if (normalized === subdomain || normalized.endsWith(`/${subdomain}`)) {
    return '';
  }
  if (normalized.startsWith(`${subdomain}/`)) {
    return normalized.slice(subdomain.length + 1);
  }
  return normalized;
};

const normalizeCustomSections = (sections?: LegalCustomSections): LegalCustomSections => ({
  privacy: sections?.privacy || [],
  cookies: sections?.cookies || [],
  notice: sections?.notice || [],
  dpa: sections?.dpa || [],
});

const buildImagekitPreview = (prefix: string, subdomain?: string | null, suffix?: string) => {
  const normalizePart = (value?: string | null) => (value || '').trim().replace(/^\/+|\/+$/g, '');
  const parts = [prefix, subdomain, suffix].map(normalizePart).filter(Boolean);
  return parts.length ? `/${parts.join('/')}` : '';
};

const colorPickerValue = (value?: string) => {
  const normalized = value ? normalizeHexInput(value) : '';
  return normalized || '#000000';
};

const BRAND_FILE_ID_FIELDS = ['logoFileId', 'heroBackgroundFileId', 'heroImageFileId', 'signImageFileId'] as const;
type BrandFileIdField = typeof BRAND_FILE_ID_FIELDS[number];
const LOCATION_LANDING_FILE_ID_FIELDS = ['heroBackgroundFileId', 'heroImageFileId', 'signImageFileId'] as const;
type LocationLandingFileIdField = typeof LOCATION_LANDING_FILE_ID_FIELDS[number];

type BrandAssetKey = 'logo' | 'heroBackground' | 'heroImage' | 'signImage';

const BRAND_ASSET_META: Record<BrandAssetKey, {
  label: string;
  description: string;
  urlField: string;
  fileIdField: BrandFileIdField;
  folder?: string;
  previewClass: string;
  imageClass: string;
}> = {
  logo: {
    label: 'Logo del cliente',
    description: 'Navbar, login y panel admin del cliente.',
    urlField: 'logoUrl',
    fileIdField: 'logoFileId',
    previewClass: 'h-16 w-16',
    imageClass: 'object-contain',
  },
  heroBackground: {
    label: 'Fondo hero (mainImage)',
    description: 'Reemplaza mainImage.webp en la cabecera.',
    urlField: 'heroBackgroundUrl',
    fileIdField: 'heroBackgroundFileId',
    folder: 'landing',
    previewClass: 'h-16 w-28',
    imageClass: 'object-cover',
  },
  heroImage: {
    label: 'Imagen principal (portada)',
    description: 'Reemplaza portada.png en la cabecera.',
    urlField: 'heroImageUrl',
    fileIdField: 'heroImageFileId',
    folder: 'landing',
    previewClass: 'h-20 w-16',
    imageClass: 'object-cover',
  },
  signImage: {
    label: 'Letrero (CTA)',
    description: 'Reemplaza letrero.png en la sección CTA.',
    urlField: 'signImageUrl',
    fileIdField: 'signImageFileId',
    folder: 'landing',
    previewClass: 'h-16 w-28',
    imageClass: 'object-cover',
  },
};

const ADMIN_SECTION_SET = new Set(ADMIN_SECTIONS.map((section) => section.key));

type LandingSectionKey = 'services' | 'products' | 'barbers' | 'cta';

const LANDING_SECTION_ORDER: LandingSectionKey[] = ['services', 'products', 'barbers', 'cta'];

const LANDING_SECTION_META: Record<LandingSectionKey, { label: string; description: string; icon: React.ElementType }> = {
  services: {
    label: 'Servicios',
    description: 'Catálogo principal con precios y ofertas.',
    icon: Scissors,
  },
  products: {
    label: 'Productos',
    description: 'Catálogo de productos destacados en la landing.',
    icon: Package,
  },
  barbers: {
    label: 'Equipo',
    description: 'Presentación de barberos y especialistas.',
    icon: Users,
  },
  cta: {
    label: 'CTA final',
    description: 'Bloque de llamada a la acción para reservar.',
    icon: Sparkles,
  },
};

const normalizeLandingOrder = (order?: string[]): LandingSectionKey[] => {
  if (!Array.isArray(order)) return [];
  const seen = new Set<string>();
  return order.filter((key): key is LandingSectionKey => {
    if (!LANDING_SECTION_ORDER.includes(key as LandingSectionKey)) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildLandingItems = (config: Record<string, any>) => {
  const landing = config?.landing || {};
  const hidden = new Set<string>((landing.hiddenSections || []) as string[]);
  const configuredOrder = normalizeLandingOrder(landing.order);
  const order = [...configuredOrder, ...LANDING_SECTION_ORDER.filter((key) => !configuredOrder.includes(key))];
  return order.map((key) => ({ key, enabled: !hidden.has(key) }));
};

const buildLandingConfigValue = (items: Array<{ key: LandingSectionKey; enabled: boolean }>) => ({
  order: items.map((item) => item.key),
  hiddenSections: items.filter((item) => !item.enabled).map((item) => item.key),
});

const reorderLandingItems = (
  items: Array<{ key: LandingSectionKey; enabled: boolean }>,
  fromIndex: number,
  toIndex: number,
) => {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return items;
  next.splice(toIndex, 0, moved);
  return next;
};

const getAdminSidebarHiddenSections = (config: Record<string, any>): AdminSectionKey[] => {
  const hidden = config?.adminSidebar?.hiddenSections;
  if (!Array.isArray(hidden)) return [];
  return hidden.filter((section): section is AdminSectionKey => {
    const key = section as AdminSectionKey;
    return ADMIN_SECTION_SET.has(key) && !ADMIN_REQUIRED_SECTIONS.includes(key);
  });
};

const isAdminSectionRequired = (section: AdminSectionKey) => ADMIN_REQUIRED_SECTIONS.includes(section);

const isAdminSectionVisible = (config: Record<string, any>, section: AdminSectionKey) => {
  if (isAdminSectionRequired(section)) return true;
  return !getAdminSidebarHiddenSections(config).includes(section);
};

const PlatformBrands: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const imagekitPrefix = import.meta.env.VITE_IMAGEKIT_FOLDER_PREFIX || 'IMAGEKIT_FOLDER';
  const [brands, setBrands] = useState<any[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [brandQuery, setBrandQuery] = useState('');
  const [brandForm, setBrandForm] = useState({ name: '', subdomain: '', customDomain: '', isActive: true });
  const [brandConfig, setBrandConfig] = useState<Record<string, any>>({});
  const [persistedBrandConfig, setPersistedBrandConfig] = useState<Record<string, any>>({});
  const [locationConfig, setLocationConfig] = useState<Record<string, any>>({});
  const [legalSettings, setLegalSettings] = useState<LegalSettings | null>(null);
  const [dpaContent, setDpaContent] = useState<LegalPolicyResponse | null>(null);
  const [isLegalLoading, setIsLegalLoading] = useState(false);
  const [isLegalSaving, setIsLegalSaving] = useState(false);
  const [aiProvidersInput, setAiProvidersInput] = useState('');
  const [bumpTarget, setBumpTarget] = useState<'privacy' | 'cookies' | 'notice' | null>(null);
  const [adminOverview, setAdminOverview] = useState<any | null>(null);
  const [adminForm, setAdminForm] = useState({
    email: '',
    localId: '',
    applyToAll: false,
  });
  const [applyThemeToAll, setApplyThemeToAll] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<BrandAssetKey | null>(null);
  const [persistedBrandFileIds, setPersistedBrandFileIds] = useState<Record<BrandFileIdField, string | null>>({
    logoFileId: null,
    heroBackgroundFileId: null,
    heroImageFileId: null,
    signImageFileId: null,
  });
  const [persistedLocationFileIds, setPersistedLocationFileIds] = useState<Record<LocationLandingFileIdField, string | null>>({
    heroBackgroundFileId: null,
    heroImageFileId: null,
    signImageFileId: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdminSaving, setIsAdminSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'datos' | 'locales' | 'admins' | 'sidebar' | 'landing' | 'config' | 'legal'>('datos');
  const [createBrandOpen, setCreateBrandOpen] = useState(false);
  const [createLocationOpen, setCreateLocationOpen] = useState(false);
  const [editLocationOpen, setEditLocationOpen] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [newBrandForm, setNewBrandForm] = useState({ name: '', subdomain: '', customDomain: '', isActive: true });
  const [newLocationForm, setNewLocationForm] = useState({ name: '', slug: '', isActive: true });
  const [editLocationForm, setEditLocationForm] = useState({ name: '', slug: '', isActive: true });
  const [draggingLandingKey, setDraggingLandingKey] = useState<LandingSectionKey | null>(null);
  const [dragOverLandingIndex, setDragOverLandingIndex] = useState<number | null>(null);
  const [draggingLandingScope, setDraggingLandingScope] = useState<'brand' | 'location' | null>(null);

  const selectedBrand = useMemo(
    () => brands.find((brand) => brand.id === selectedBrandId) || null,
    [brands, selectedBrandId],
  );
  const legalCustomSections = useMemo(
    () => normalizeCustomSections(legalSettings?.optionalCustomSections),
    [legalSettings?.optionalCustomSections],
  );
  const filteredBrands = useMemo(() => {
    const query = brandQuery.trim().toLowerCase();
    if (!query) return brands;
    return brands.filter((brand) => {
      const name = brand.name?.toLowerCase() || '';
      const subdomain = brand.subdomain?.toLowerCase() || '';
      const customDomain = brand.customDomain?.toLowerCase() || '';
      return name.includes(query) || subdomain.includes(query) || customDomain.includes(query);
    });
  }, [brands, brandQuery]);
  const adminLocations = useMemo(() => adminOverview?.locations || [], [adminOverview]);
  const adminCounts = useMemo(() => {
    const counts = new Map<string, number>();
    adminLocations.forEach((location: any) => {
      location.admins?.forEach((admin: any) => {
        if (admin.isPlatformAdmin) return;
        counts.set(admin.userId, (counts.get(admin.userId) || 0) + 1);
      });
    });
    return counts;
  }, [adminLocations]);

  const loadBrands = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const data = await getPlatformBrands(user.id);
      setBrands(data);
      if (!selectedBrandId && data.length) {
        setSelectedBrandId(data[0].id);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar las marcas.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBrandId) {
      setActiveTab('datos');
    }
  }, [selectedBrandId]);

  const loadBrandDetails = async (brandId: string) => {
    if (!user?.id) return;
    try {
      const [brand, config, admins] = await Promise.all([
        getPlatformBrand(user.id, brandId),
        getPlatformBrandConfig(user.id, brandId),
        getPlatformBrandAdmins(user.id, brandId),
      ]);
      setBrandForm({
        name: brand.name,
        subdomain: brand.subdomain,
        customDomain: brand.customDomain || '',
        isActive: brand.isActive,
      });
      const normalizedBrandConfig = stripEmptyTheme(config || {});
      if (normalizedBrandConfig.imagekit?.folder) {
        normalizedBrandConfig.imagekit = {
          ...normalizedBrandConfig.imagekit,
          folder: normalizeImagekitFolder(normalizedBrandConfig.imagekit.folder as string, brand.subdomain),
        };
      }
      setBrandConfig(normalizedBrandConfig);
      setPersistedBrandConfig(JSON.parse(JSON.stringify(normalizedBrandConfig)));
      setPersistedBrandFileIds({
        logoFileId: config?.branding?.logoFileId || null,
        heroBackgroundFileId: config?.branding?.heroBackgroundFileId || null,
        heroImageFileId: config?.branding?.heroImageFileId || null,
        signImageFileId: config?.branding?.signImageFileId || null,
      });
      setAdminOverview(admins || null);
      const defaultLocation = brand.defaultLocationId || brand.locations?.[0]?.id || null;
      setSelectedLocationId(defaultLocation);
      setAdminForm((prev) => ({
        ...prev,
        localId: defaultLocation || brand.locations?.[0]?.id || '',
        applyToAll: false,
      }));
      if (defaultLocation) {
        const locationCfg = await getPlatformLocationConfig(user.id, defaultLocation);
        const normalizedLocationCfg = stripEmptyTheme(locationCfg || {});
        if (normalizedLocationCfg.imagekit?.folder) {
          normalizedLocationCfg.imagekit = {
            ...normalizedLocationCfg.imagekit,
            folder: normalizeImagekitFolder(normalizedLocationCfg.imagekit.folder as string, brand.subdomain),
          };
        }
        setLocationConfig(normalizedLocationCfg);
        setPersistedLocationFileIds({
          heroBackgroundFileId: locationCfg?.branding?.heroBackgroundFileId || null,
          heroImageFileId: locationCfg?.branding?.heroImageFileId || null,
          signImageFileId: locationCfg?.branding?.signImageFileId || null,
        });
      } else {
        setLocationConfig({});
        setPersistedLocationFileIds({
          heroBackgroundFileId: null,
          heroImageFileId: null,
          signImageFileId: null,
        });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo cargar la marca.', variant: 'destructive' });
    }
  };

  const loadLegalInfo = async (brandId: string) => {
    if (!user?.id) return;
    setIsLegalLoading(true);
    try {
      const [legal, dpa] = await Promise.all([
        getPlatformBrandLegalSettings(user.id, brandId),
        getPlatformBrandDpa(user.id, brandId),
      ]);
      if (legal) {
        setLegalSettings({
          ...legal,
          optionalCustomSections: normalizeCustomSections(legal.optionalCustomSections),
        });
        setAiProvidersInput(legal.aiProviderNames?.join(', ') || '');
      } else {
        setLegalSettings(null);
        setAiProvidersInput('');
      }
      setDpaContent(dpa || null);
    } catch (error) {
      setLegalSettings(null);
      setDpaContent(null);
      toast({ title: 'Aviso', description: 'No se pudo cargar el contenido legal.', variant: 'destructive' });
    } finally {
      setIsLegalLoading(false);
    }
  };

  useEffect(() => {
    loadBrands();
  }, [user?.id]);

  useEffect(() => {
    if (selectedBrandId) {
      loadBrandDetails(selectedBrandId);
      loadLegalInfo(selectedBrandId);
    }
  }, [selectedBrandId]);

  useEffect(() => {
    const loadLocationConfig = async () => {
      if (!user?.id || !selectedLocationId || !selectedBrand) return;
      const config = await getPlatformLocationConfig(user.id, selectedLocationId);
      const normalizedConfig = config || {};
      if (normalizedConfig.imagekit?.folder) {
        normalizedConfig.imagekit = {
          ...normalizedConfig.imagekit,
          folder: normalizeImagekitFolder(normalizedConfig.imagekit.folder as string, selectedBrand.subdomain),
        };
      }
      setLocationConfig(normalizedConfig);
      setPersistedLocationFileIds({
        heroBackgroundFileId: config?.branding?.heroBackgroundFileId || null,
        heroImageFileId: config?.branding?.heroImageFileId || null,
        signImageFileId: config?.branding?.signImageFileId || null,
      });
    };
    loadLocationConfig();
  }, [selectedLocationId, selectedBrand, user?.id]);

  useEffect(() => {
    if (adminForm.applyToAll || adminForm.localId) return;
    const fallback = selectedLocationId || adminLocations[0]?.id || '';
    if (fallback) {
      setAdminForm((prev) => ({ ...prev, localId: fallback }));
    }
  }, [adminForm.applyToAll, adminForm.localId, adminLocations, selectedLocationId]);

  const isLocationSidebarOverride = Array.isArray(locationConfig?.adminSidebar?.hiddenSections);
  const locationSidebarConfig = isLocationSidebarOverride ? locationConfig : brandConfig;
  const brandStockVisible = isAdminSectionVisible(brandConfig, 'stock');
  const locationStockVisible = isAdminSectionVisible(locationSidebarConfig, 'stock');
  const brandLandingItems = useMemo(
    () => buildLandingItems(brandConfig).filter((item) => brandStockVisible || item.key !== 'products'),
    [brandConfig, brandStockVisible],
  );
  const isLocationLandingOverride = Boolean(locationConfig?.landing);
  const locationLandingItems = useMemo(
    () =>
      buildLandingItems(isLocationLandingOverride ? locationConfig : brandConfig).filter(
        (item) => locationStockVisible || item.key !== 'products',
      ),
    [locationConfig, brandConfig, isLocationLandingOverride, locationStockVisible],
  );
  const isLocationNotificationOverride = Boolean(locationConfig?.notificationPrefs);
  const brandNotificationPrefs = {
    email: brandConfig?.notificationPrefs?.email !== false,
    whatsapp: brandConfig?.notificationPrefs?.whatsapp !== false,
    sms: brandConfig?.notificationPrefs?.sms !== false,
  };
  const isLocationBrandingOverride = Boolean(locationConfig?.branding);
  const locationNotificationPrefsSource = isLocationNotificationOverride
    ? locationConfig.notificationPrefs
    : brandConfig.notificationPrefs;
  const locationNotificationPrefs = {
    email: locationNotificationPrefsSource?.email !== false,
    whatsapp: locationNotificationPrefsSource?.whatsapp !== false,
    sms: locationNotificationPrefsSource?.sms !== false,
  };

  const updateSidebarVisibility = (
    setConfig: React.Dispatch<React.SetStateAction<Record<string, any>>>,
    section: AdminSectionKey,
    visible: boolean,
  ) => {
    setConfig((prev) => {
      const hidden = new Set(getAdminSidebarHiddenSections(prev));
      if (visible) {
        hidden.delete(section);
      } else {
        hidden.add(section);
      }
      ADMIN_REQUIRED_SECTIONS.forEach((required) => hidden.delete(required));
      return updateNestedValue(prev, ['adminSidebar', 'hiddenSections'], Array.from(hidden));
    });
  };

  const handleLocationSidebarOverride = (checked: boolean) => {
    if (checked) {
      const baseHidden = getAdminSidebarHiddenSections(brandConfig);
      setLocationConfig((prev) => updateNestedValue(prev, ['adminSidebar', 'hiddenSections'], baseHidden));
      return;
    }
    setLocationConfig((prev) => {
      if (!prev.adminSidebar) return prev;
      const { adminSidebar, ...rest } = prev;
      return rest;
    });
  };

  const handleLocationNotificationOverride = (checked: boolean) => {
    if (checked) {
      setLocationConfig((prev) => updateNestedValue(prev, ['notificationPrefs'], { ...brandNotificationPrefs }));
      return;
    }
    setLocationConfig((prev) => {
      if (!prev.notificationPrefs) return prev;
      const { notificationPrefs, ...rest } = prev;
      return rest;
    });
  };

  const updateLandingConfig = (
    setConfig: React.Dispatch<React.SetStateAction<Record<string, any>>>,
    items: Array<{ key: LandingSectionKey; enabled: boolean }>,
  ) => {
    setConfig((prev) => updateNestedValue(prev, ['landing'], buildLandingConfigValue(items)));
  };

  const handleLandingDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    index: number,
    scope: 'brand' | 'location',
  ) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
    const key = event.currentTarget.dataset.sectionKey as LandingSectionKey | undefined;
    if (key) {
      setDraggingLandingKey(key);
    }
    setDraggingLandingScope(scope);
    setDragOverLandingIndex(index);
  };

  const handleLandingDrop = (
    setConfig: React.Dispatch<React.SetStateAction<Record<string, any>>>,
    items: Array<{ key: LandingSectionKey; enabled: boolean }>,
    event: React.DragEvent<HTMLDivElement>,
    index: number,
  ) => {
    event.preventDefault();
    const fromIndex = Number(event.dataTransfer.getData('text/plain'));
    if (Number.isNaN(fromIndex) || fromIndex === index) return;
    updateLandingConfig(setConfig, reorderLandingItems(items, fromIndex, index));
    setDraggingLandingKey(null);
    setDragOverLandingIndex(null);
    setDraggingLandingScope(null);
  };

  const handleLandingDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    index: number,
    scope: 'brand' | 'location',
  ) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverLandingIndex(index);
    if (!draggingLandingScope) {
      setDraggingLandingScope(scope);
    }
  };

  const handleLandingToggle = (
    setConfig: React.Dispatch<React.SetStateAction<Record<string, any>>>,
    items: Array<{ key: LandingSectionKey; enabled: boolean }>,
    key: LandingSectionKey,
    enabled: boolean,
  ) => {
    updateLandingConfig(
      setConfig,
      items.map((item) => (item.key === key ? { ...item, enabled } : item)),
    );
  };

  const handleLandingDragEnd = () => {
    setDraggingLandingKey(null);
    setDragOverLandingIndex(null);
    setDraggingLandingScope(null);
  };

  const handleLocationLandingOverride = (checked: boolean) => {
    if (checked) {
      updateLandingConfig(setLocationConfig, brandLandingItems);
      return;
    }
    setLocationConfig((prev) => {
      if (!prev.landing) return prev;
      const { landing, ...rest } = prev;
      return rest;
    });
  };

  const handleLocationLandingImagesOverride = (checked: boolean) => {
    if (checked) {
      const baseBranding = brandConfig?.branding || {};
      setLocationConfig((prev) =>
        updateNestedValue(prev, ['branding'], {
          heroBackgroundUrl: baseBranding.heroBackgroundUrl || '',
          heroBackgroundFileId: baseBranding.heroBackgroundFileId || '',
          heroImageUrl: baseBranding.heroImageUrl || '',
          heroImageFileId: baseBranding.heroImageFileId || '',
          signImageUrl: baseBranding.signImageUrl || '',
          signImageFileId: baseBranding.signImageFileId || '',
        }),
      );
      return;
    }
    setLocationConfig((prev) => {
      if (!prev.branding) return prev;
      const { branding, ...rest } = prev;
      return rest;
    });
  };

  const handleSaveBrand = async () => {
    if (!user?.id || !selectedBrand) return;
    setIsSaving(true);
    try {
      const previousPrimary = normalizeHexInput(persistedBrandConfig?.theme?.primary || '');
      const nextPrimary = normalizeHexInput(brandConfig.theme?.primary || '');
      const sanitizedBrandConfig = stripEmptyTheme(brandConfig);
      const sanitizedTwilioSender = typeof sanitizedBrandConfig.twilio?.smsSenderId === 'string'
        ? sanitizedBrandConfig.twilio.smsSenderId.trim()
        : '';
      const cleanedBrandConfig = { ...sanitizedBrandConfig } as Record<string, any>;
      if (sanitizedTwilioSender) {
        cleanedBrandConfig.twilio = { smsSenderId: sanitizedTwilioSender };
      } else {
        delete cleanedBrandConfig.twilio;
      }
      const sanitizedLocationConfig = stripEmptyTheme(locationConfig);
      await updatePlatformBrand(user.id, selectedBrand.id, {
        name: brandForm.name,
        subdomain: brandForm.subdomain,
        customDomain: brandForm.customDomain || null,
        isActive: brandForm.isActive,
        defaultLocationId: selectedLocationId,
      });
      await updatePlatformBrandConfig(user.id, selectedBrand.id, cleanedBrandConfig);
      if (selectedLocationId) {
        await updatePlatformLocationConfig(user.id, selectedLocationId, sanitizedLocationConfig);
      }
      const shouldSyncBrandTheme =
        !applyThemeToAll && previousPrimary && nextPrimary && previousPrimary !== nextPrimary;
      if (applyThemeToAll && selectedBrand.locations?.length) {
        const targetColor = locationConfig?.theme?.primary;
        if (targetColor) {
          await Promise.all(
            selectedBrand.locations.map(async (location: any) => {
              const existing = await getPlatformLocationConfig(user.id, location.id);
              const next = updateNestedValue(existing || {}, ['theme', 'primary'], targetColor);
              await updatePlatformLocationConfig(user.id, location.id, next);
            }),
          );
        }
      } else if (shouldSyncBrandTheme && selectedBrand.locations?.length) {
        await Promise.all(
          selectedBrand.locations.map(async (location: any) => {
            const existing = await getPlatformLocationConfig(user.id, location.id);
            const existingPrimary = normalizeHexInput(existing?.theme?.primary || '');
            if (!existingPrimary || existingPrimary !== previousPrimary) return;
            const next = { ...(existing || {}) } as Record<string, any>;
            const theme = { ...(next.theme || {}) };
            delete theme.primary;
            if (Object.keys(theme).length === 0) {
              delete next.theme;
            } else {
              next.theme = theme;
            }
            await updatePlatformLocationConfig(user.id, location.id, next);
          }),
        );
      }
      const currentFileIds = BRAND_FILE_ID_FIELDS.reduce((acc, field) => {
        acc[field] = (sanitizedBrandConfig?.branding?.[field] as string | undefined) || null;
        return acc;
      }, {} as Record<BrandFileIdField, string | null>);

      await Promise.all(
        BRAND_FILE_ID_FIELDS.map(async (field) => {
          const previous = persistedBrandFileIds[field];
          const next = currentFileIds[field];
          if (!previous || previous === next) return;
          try {
            await deleteFromImageKit(previous, { subdomainOverride: selectedBrand.subdomain });
          } catch (cleanupError) {
            console.error(cleanupError);
            toast({
              title: 'Aviso',
              description: 'No se pudo borrar una imagen anterior en storage.',
              variant: 'destructive',
            });
          }
        }),
      );
      setPersistedBrandFileIds(currentFileIds);
      if (selectedLocationId) {
        setPersistedLocationFileIds({
          heroBackgroundFileId: locationConfig?.branding?.heroBackgroundFileId || null,
          heroImageFileId: locationConfig?.branding?.heroImageFileId || null,
          signImageFileId: locationConfig?.branding?.signImageFileId || null,
        });
      }
      setPersistedBrandConfig(JSON.parse(JSON.stringify(sanitizedBrandConfig)));
      setBrandConfig(sanitizedBrandConfig);
      setLocationConfig(sanitizedLocationConfig);
      await loadBrands();
      toast({ title: 'Actualizado', description: 'Marca y configuración guardadas.' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo guardar la marca.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const updateLegalField = <K extends keyof LegalSettings>(field: K, value: LegalSettings[K]) => {
    setLegalSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const updateLegalSubProcessor = (index: number, field: keyof SubProcessor, value: string) => {
    setLegalSettings((prev) => {
      if (!prev) return prev;
      const next = [...(prev.subProcessors || [])];
      const current = next[index] || { name: '', purpose: '', country: '', dataTypes: '', link: '' };
      next[index] = { ...current, [field]: value };
      return { ...prev, subProcessors: next };
    });
  };

  const addLegalSubProcessor = () => {
    setLegalSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        subProcessors: [
          ...(prev.subProcessors || []),
          { name: '', purpose: '', country: '', dataTypes: '', link: '' },
        ],
      };
    });
  };

  const removeLegalSubProcessor = (index: number) => {
    setLegalSettings((prev) => {
      if (!prev) return prev;
      const next = [...(prev.subProcessors || [])];
      next.splice(index, 1);
      return { ...prev, subProcessors: next };
    });
  };

  const updateLegalCustomSection = (
    pageKey: keyof LegalCustomSections,
    index: number,
    field: 'heading' | 'bodyMarkdown',
    value: string,
  ) => {
    setLegalSettings((prev) => {
      if (!prev) return prev;
      const sections = normalizeCustomSections(prev.optionalCustomSections);
      const list = [...(sections[pageKey] || [])];
      const current = list[index] || { heading: '', bodyMarkdown: '' };
      list[index] = { ...current, [field]: value };
      return {
        ...prev,
        optionalCustomSections: { ...sections, [pageKey]: list },
      };
    });
  };

  const addLegalCustomSection = (pageKey: keyof LegalCustomSections) => {
    setLegalSettings((prev) => {
      if (!prev) return prev;
      const sections = normalizeCustomSections(prev.optionalCustomSections);
      const list = [...(sections[pageKey] || []), { heading: '', bodyMarkdown: '' }];
      return { ...prev, optionalCustomSections: { ...sections, [pageKey]: list } };
    });
  };

  const removeLegalCustomSection = (pageKey: keyof LegalCustomSections, index: number) => {
    setLegalSettings((prev) => {
      if (!prev) return prev;
      const sections = normalizeCustomSections(prev.optionalCustomSections);
      const list = [...(sections[pageKey] || [])];
      list.splice(index, 1);
      return { ...prev, optionalCustomSections: { ...sections, [pageKey]: list } };
    });
  };

  const handleVersionBump = () => {
    if (!bumpTarget) return;
    setLegalSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        privacyPolicyVersion: bumpTarget === 'privacy' ? prev.privacyPolicyVersion + 1 : prev.privacyPolicyVersion,
        cookiePolicyVersion: bumpTarget === 'cookies' ? prev.cookiePolicyVersion + 1 : prev.cookiePolicyVersion,
        legalNoticeVersion: bumpTarget === 'notice' ? prev.legalNoticeVersion + 1 : prev.legalNoticeVersion,
      };
    });
    setBumpTarget(null);
  };

  const handleSaveLegal = async () => {
    if (!user?.id || !selectedBrand || !legalSettings) return;
    setIsLegalSaving(true);
    try {
      const aiProviderNames = aiProvidersInput
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      const payload: Partial<LegalSettings> = {
        ...legalSettings,
        aiProviderNames,
        legalOwnerName: legalSettings.legalOwnerName?.trim() || null,
        legalOwnerTaxId: legalSettings.legalOwnerTaxId?.trim() || null,
        legalOwnerAddress: legalSettings.legalOwnerAddress?.trim() || null,
        legalContactEmail: legalSettings.legalContactEmail?.trim() || null,
        legalContactPhone: legalSettings.legalContactPhone?.trim() || null,
        optionalCustomSections: normalizeCustomSections(legalSettings.optionalCustomSections),
        retentionDays: legalSettings.retentionDays ? Number(legalSettings.retentionDays) : null,
      };
      const updated = await updatePlatformBrandLegalSettings(user.id, selectedBrand.id, payload);
      setLegalSettings({
        ...updated,
        optionalCustomSections: normalizeCustomSections(updated.optionalCustomSections),
      });
      setAiProvidersInput(updated.aiProviderNames?.join(', ') || '');
      const dpa = await getPlatformBrandDpa(user.id, selectedBrand.id);
      setDpaContent(dpa);
      toast({ title: 'Legal actualizado', description: 'Cambios guardados en la marca.' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo guardar el legal.', variant: 'destructive' });
    } finally {
      setIsLegalSaving(false);
    }
  };

  const handleCreateBrand = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const created = await createPlatformBrand(user.id, {
        name: newBrandForm.name,
        subdomain: newBrandForm.subdomain,
        customDomain: newBrandForm.customDomain || null,
        isActive: newBrandForm.isActive,
      });
      setCreateBrandOpen(false);
      setNewBrandForm({ name: '', subdomain: '', customDomain: '', isActive: true });
      await loadBrands();
      setSelectedBrandId(created.id);
      toast({ title: 'Marca creada', description: 'Ya puedes configurar sus locales y credenciales.' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo crear la marca.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const updateBrandingFields = (updates: Record<string, string>) => {
    setBrandConfig((prev) => {
      let next = { ...prev };
      Object.entries(updates).forEach(([field, value]) => {
        next = updateNestedValue(next, ['branding', field], value);
      });
      return next;
    });
  };

  const updateLocationBrandingFields = (updates: Record<string, string>) => {
    setLocationConfig((prev) => {
      let next = { ...prev };
      Object.entries(updates).forEach(([field, value]) => {
        next = updateNestedValue(next, ['branding', field], value);
      });
      return next;
    });
  };

  const handleBrandAssetUpload = async (file: File | null, assetKey: BrandAssetKey) => {
    if (!file || !user?.id || !selectedBrand) return;
    const asset = BRAND_ASSET_META[assetKey];
    const previousFileId = (brandConfig?.branding?.[asset.fileIdField] as string | undefined) || '';
    const persistedFileId = persistedBrandFileIds[asset.fileIdField];
    setUploadingAsset(assetKey);
    try {
      const fileName = `brand-${assetKey}-${selectedBrand.subdomain || selectedBrand.id}-${Date.now()}`;
      const { url, fileId } = await uploadToImageKit(file, fileName, asset.folder, {
        subdomainOverride: selectedBrand.subdomain,
      });
      updateBrandingFields({
        [asset.urlField]: url,
        [asset.fileIdField]: fileId,
      });
      if (previousFileId && previousFileId !== fileId && previousFileId !== persistedFileId) {
        try {
          await deleteFromImageKit(previousFileId, { subdomainOverride: selectedBrand.subdomain });
        } catch (cleanupError) {
          console.error(cleanupError);
          toast({
            title: 'Aviso',
            description: 'No se pudo borrar la imagen anterior en storage.',
            variant: 'destructive',
          });
        }
      }
      toast({ title: 'Imagen subida', description: 'Guarda los cambios para aplicarla.' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo subir la imagen.', variant: 'destructive' });
    } finally {
      setUploadingAsset(null);
    }
  };

  const handleRemoveBrandAsset = (assetKey: BrandAssetKey) => {
    const asset = BRAND_ASSET_META[assetKey];
    updateBrandingFields({
      [asset.urlField]: '',
      [asset.fileIdField]: '',
    });
    toast({ title: 'Imagen eliminada', description: 'Guarda los cambios para aplicar.' });
  };

  const handleLocationAssetUpload = async (file: File | null, assetKey: BrandAssetKey) => {
    if (!file || !user?.id || !selectedBrand || !selectedLocationId) return;
    const asset = BRAND_ASSET_META[assetKey];
    const previousFileId = (locationConfig?.branding?.[asset.fileIdField] as string | undefined) || '';
    const persistedFileId = persistedLocationFileIds[asset.fileIdField as LocationLandingFileIdField] || null;
    setUploadingAsset(assetKey);
    try {
      const fileName = `location-${assetKey}-${selectedLocationId}-${Date.now()}`;
      const folder = locationConfig?.imagekit?.folder || asset.folder;
      const { url, fileId } = await uploadToImageKit(file, fileName, folder, {
        subdomainOverride: selectedBrand.subdomain,
      });
      updateLocationBrandingFields({
        [asset.urlField]: url,
        [asset.fileIdField]: fileId,
      });
      if (previousFileId && previousFileId !== fileId && previousFileId !== persistedFileId) {
        try {
          await deleteFromImageKit(previousFileId, { subdomainOverride: selectedBrand.subdomain });
        } catch (cleanupError) {
          console.error(cleanupError);
          toast({
            title: 'Aviso',
            description: 'No se pudo borrar la imagen anterior en storage.',
            variant: 'destructive',
          });
        }
      }
      toast({ title: 'Imagen subida', description: 'Guarda los cambios para aplicarla.' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo subir la imagen.', variant: 'destructive' });
    } finally {
      setUploadingAsset(null);
    }
  };

  const handleRemoveLocationAsset = (assetKey: BrandAssetKey) => {
    const asset = BRAND_ASSET_META[assetKey];
    updateLocationBrandingFields({
      [asset.urlField]: '',
      [asset.fileIdField]: '',
    });
    toast({ title: 'Imagen eliminada', description: 'Guarda los cambios para aplicar.' });
  };

  const handleDeleteBrand = async () => {
    if (!user?.id || !selectedBrand) return;
    if (!window.confirm('¿Seguro que quieres eliminar esta marca?')) return;
    try {
      await deletePlatformBrand(user.id, selectedBrand.id);
      setSelectedBrandId(null);
      await loadBrands();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar la marca.', variant: 'destructive' });
    }
  };

  const handleCreateLocation = async () => {
    if (!user?.id || !selectedBrand) return;
    try {
      const location = await createPlatformLocation(user.id, selectedBrand.id, {
        name: newLocationForm.name,
        slug: newLocationForm.slug || null,
        isActive: newLocationForm.isActive,
      });
      setCreateLocationOpen(false);
      setNewLocationForm({ name: '', slug: '', isActive: true });
      await loadBrands();
      setSelectedLocationId(location.id);
      await loadBrandDetails(selectedBrand.id);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo crear el local.', variant: 'destructive' });
    }
  };

  const handleUpdateLocation = async (localId: string, payload: { name?: string; slug?: string | null; isActive?: boolean }) => {
    if (!user?.id) return;
    try {
      await updatePlatformLocation(user.id, localId, payload);
      await loadBrands();
      if (selectedBrand) {
        await loadBrandDetails(selectedBrand.id);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar el local.', variant: 'destructive' });
    }
  };

  const handleDeleteLocation = async (localId: string) => {
    if (!user?.id) return;
    if (!window.confirm('¿Seguro que quieres eliminar este local?')) return;
    try {
      await deletePlatformLocation(user.id, localId);
      await loadBrands();
      if (selectedBrand) {
        await loadBrandDetails(selectedBrand.id);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar el local.', variant: 'destructive' });
    }
  };

  const handleAssignAdmin = async () => {
    if (!user?.id || !selectedBrand) return;
    const email = adminForm.email.trim().toLowerCase();
    if (!email) {
      toast({ title: 'Falta email', description: 'Introduce el email del admin.', variant: 'destructive' });
      return;
    }
    const applyToAll = adminForm.applyToAll;
    const localId = applyToAll ? undefined : adminForm.localId || selectedLocationId || undefined;
    if (!applyToAll && !localId) {
      toast({ title: 'Selecciona un local', description: 'Elige un local o aplica a todos.', variant: 'destructive' });
      return;
    }

    setIsAdminSaving(true);
    try {
      await assignPlatformBrandAdmin(user.id, selectedBrand.id, {
        email,
        applyToAll,
        localId,
        adminRoleId: null,
      });
      toast({ title: 'Admin asignado', description: 'El acceso se ha actualizado.' });
      setAdminForm((prev) => ({
        ...prev,
        email: '',
      }));
      await loadBrandDetails(selectedBrand.id);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo asignar el admin.', variant: 'destructive' });
    } finally {
      setIsAdminSaving(false);
    }
  };

  const handleRemoveAdmin = async (payload: { userId: string; localId?: string; removeFromAll?: boolean }) => {
    if (!user?.id || !selectedBrand) return;
    setIsAdminSaving(true);
    try {
      await removePlatformBrandAdmin(user.id, selectedBrand.id, payload);
      toast({ title: 'Admin eliminado', description: 'El acceso se ha revocado.' });
      await loadBrandDetails(selectedBrand.id);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar el admin.', variant: 'destructive' });
    } finally {
      setIsAdminSaving(false);
    }
  };

  const renderBrandAssetInput = (assetKey: BrandAssetKey, className = '') => {
    const asset = BRAND_ASSET_META[assetKey];
    const urlValue = (brandConfig?.branding?.[asset.urlField] as string | undefined) || '';
    const isUploading = uploadingAsset === assetKey;
    const isAnyUpload = Boolean(uploadingAsset);

    return (
      <div key={assetKey} className={`${className} space-y-2`}>
        <Label>{asset.label}</Label>
        <div className="flex flex-col sm:flex-row gap-4">
          <div
            className={`${asset.previewClass} rounded-xl border border-border/60 bg-muted/40 flex items-center justify-center overflow-hidden`}
          >
            {urlValue ? (
              <img
                src={urlValue}
                alt={asset.label}
                className={`h-full w-full ${asset.imageClass}`}
              />
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <Input
              type="file"
              accept="image/*"
              disabled={isAnyUpload}
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                event.target.value = '';
                handleBrandAssetUpload(file, assetKey);
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRemoveBrandAsset(assetKey)}
                disabled={isAnyUpload}
              >
                Quitar imagen
              </Button>
              {isUploading && (
                <span className="text-xs text-muted-foreground self-center">Subiendo...</span>
              )}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{asset.description}</p>
      </div>
    );
  };

  const renderLocationAssetInput = (
    assetKey: BrandAssetKey,
    options?: { disabled?: boolean; inheritedLabel?: string },
  ) => {
    const asset = BRAND_ASSET_META[assetKey];
    const isDisabled = Boolean(options?.disabled);
    const locationUrlValue = (locationConfig?.branding?.[asset.urlField] as string | undefined) || '';
    const brandUrlValue = (brandConfig?.branding?.[asset.urlField] as string | undefined) || '';
    const urlValue = isDisabled ? brandUrlValue : locationUrlValue;
    const isUploading = uploadingAsset === assetKey;
    const isAnyUpload = Boolean(uploadingAsset);

    return (
      <div key={assetKey} className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label>{asset.label}</Label>
          {isDisabled && options?.inheritedLabel && (
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {options.inheritedLabel}
            </span>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div
            className={`${asset.previewClass} rounded-xl border border-border/60 bg-muted/40 flex items-center justify-center overflow-hidden`}
          >
            {urlValue ? (
              <img
                src={urlValue}
                alt={asset.label}
                className={`h-full w-full ${asset.imageClass}`}
              />
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <Input
              type="file"
              accept="image/*"
              disabled={isAnyUpload || isDisabled}
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                event.target.value = '';
                handleLocationAssetUpload(file, assetKey);
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRemoveLocationAsset(assetKey)}
                disabled={isAnyUpload || isDisabled}
              >
                Quitar imagen
              </Button>
              {isUploading && (
                <span className="text-xs text-muted-foreground self-center">Subiendo...</span>
              )}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{asset.description}</p>
      </div>
    );
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Cargando marcas...</div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr] animate-fade-in h-[calc(100dvh-2rem)] sm:h-[calc(100dvh-3rem)] md:h-[calc(100dvh-4rem)] overflow-hidden">
      <Card className="border border-border/60 bg-card/70 h-full flex flex-col overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Marcas</CardTitle>
          <Button size="sm" onClick={() => setCreateBrandOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nueva
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 overflow-y-auto flex-1">
          {brands.length > 10 && (
            <div className="space-y-2">
              <Input
                value={brandQuery}
                onChange={(e) => setBrandQuery(e.target.value)}
                placeholder="Buscar marca..."
              />
            </div>
          )}
          {filteredBrands.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin resultados.</p>
          ) : (
            filteredBrands.map((brand) => (
            <button
              key={brand.id}
              onClick={() => setSelectedBrandId(brand.id)}
              className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                selectedBrandId === brand.id
                  ? 'border-primary/50 bg-primary/10'
                  : 'border-border/60 hover:border-primary/40 hover:bg-card/80'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-foreground">{brand.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {brand.customDomain || `${brand.subdomain}.managgio.com`}
                  </div>
                </div>
                <div className={`text-xs px-2 py-1 rounded-full ${brand.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                  {brand.isActive ? 'Activo' : 'Inactivo'}
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                <MapPin className="h-3 w-3" />
                {brand.locations?.length || 0} locales
              </div>
            </button>
            ))
          )}
        </CardContent>
      </Card>

      {selectedBrand ? (
        <Card className="border border-border/60 bg-card/70 h-full flex flex-col overflow-hidden">
          <CardHeader className="flex flex-col gap-1 bg-card">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                {selectedBrand.name}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={handleDeleteBrand}>
                <Trash2 className="h-4 w-4 mr-1" />
                Eliminar
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Gestiona datos generales, locales y credenciales.</p>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="space-y-6">
              <div className="sticky top-0 z-10 -mx-6 border-b border-border/60 bg-card px-6 py-3 shadow-[0_10px_24px_-20px_hsl(var(--background)/0.9)]">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-7">
                  <TabsTrigger value="datos">Datos</TabsTrigger>
                  <TabsTrigger value="locales">Locales</TabsTrigger>
                  <TabsTrigger value="admins">Admins</TabsTrigger>
                  <TabsTrigger value="sidebar">Sidebar</TabsTrigger>
                  <TabsTrigger value="landing">Landing</TabsTrigger>
                  <TabsTrigger value="config">Config</TabsTrigger>
                  <TabsTrigger value="legal">Legal</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="datos" className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nombre comercial</Label>
                    <Input value={brandForm.name} onChange={(e) => setBrandForm((prev) => ({ ...prev, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Subdominio</Label>
                    <Input value={brandForm.subdomain} onChange={(e) => setBrandForm((prev) => ({ ...prev, subdomain: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Dominio personalizado</Label>
                    <Input
                      value={brandForm.customDomain}
                      placeholder="www.ejemplo.com"
                      onChange={(e) => setBrandForm((prev) => ({ ...prev, customDomain: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Local por defecto</Label>
                    <Select value={selectedLocationId || undefined} onValueChange={setSelectedLocationId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona local" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedBrand.locations?.map((location: any) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={brandForm.isActive}
                      onCheckedChange={(checked) => setBrandForm((prev) => ({ ...prev, isActive: checked }))}
                    />
                    <span className="text-sm text-muted-foreground">Marca activa</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveBrand} disabled={isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar cambios
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="locales" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold">Locales</h3>
                    <p className="text-sm text-muted-foreground">Añade o ajusta locales por marca.</p>
                  </div>
                  <Button size="sm" onClick={() => setCreateLocationOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Nuevo local
                  </Button>
                </div>
                <div className="space-y-3">
                  {selectedBrand.locations?.map((location: any) => (
                    <div key={location.id} className="border border-border/60 rounded-xl p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold">{location.name}</div>
                          <div className="text-xs text-muted-foreground">{location.slug || 'sin slug'}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedLocationId(location.id);
                              setEditingLocationId(location.id);
                              setEditLocationForm({
                                name: location.name,
                                slug: location.slug || '',
                                isActive: location.isActive,
                              });
                              setEditLocationOpen(true);
                            }}
                          >
                            Editar
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteLocation(location.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="admins" className="space-y-6">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Users className="h-4 w-4 text-primary" />
                  Administración por local
                </div>
                <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                  <Card className="border border-border/60 bg-card/80">
                    <CardHeader>
                      <CardTitle className="text-base">Asignar admin</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Email del usuario</Label>
                        <Input
                          value={adminForm.email}
                          onChange={(e) => setAdminForm((prev) => ({ ...prev, email: e.target.value }))}
                          placeholder="cliente@marca.com"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={adminForm.applyToAll}
                          onCheckedChange={(checked) =>
                            setAdminForm((prev) => ({ ...prev, applyToAll: checked }))
                          }
                        />
                        <span className="text-sm text-muted-foreground">Asignar a todos los locales</span>
                      </div>
                      {!adminForm.applyToAll ? (
                        <>
                          <div className="space-y-2">
                            <Label>Local</Label>
                            <Select
                              value={adminForm.localId || undefined}
                              onValueChange={(value) => setAdminForm((prev) => ({ ...prev, localId: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona local" />
                              </SelectTrigger>
                              <SelectContent>
                                {adminLocations.map((location: any) => (
                                  <SelectItem key={location.id} value={location.id}>
                                    {location.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          La asignación global da acceso a todos los locales.
                        </p>
                      )}
                      <Button onClick={handleAssignAdmin} disabled={isAdminSaving}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Asignar admin
                      </Button>
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    {adminLocations.length === 0 ? (
                      <Card className="border border-border/60 bg-card/70">
                        <CardContent className="text-sm text-muted-foreground">
                          No hay locales disponibles para asignar admins.
                        </CardContent>
                      </Card>
                    ) : (
                      adminLocations.map((location: any) => (
                        <Card key={location.id} className="border border-border/60 bg-card/70">
                          <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                              <CardTitle className="text-base">{location.name}</CardTitle>
                              <p className="text-xs text-muted-foreground">{location.slug || 'sin slug'}</p>
                            </div>
                            <div className={`text-xs px-2 py-1 rounded-full ${location.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                              {location.isActive ? 'Activo' : 'Inactivo'}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {location.admins?.filter((admin: any) => !admin.isPlatformAdmin).length ? (
                              location.admins
                                .filter((admin: any) => !admin.isPlatformAdmin)
                                .map((admin: any) => (
                                <div key={admin.userId} className="flex items-center justify-between gap-4 border border-border/50 rounded-xl px-3 py-2">
                                  <div>
                                    <div className="text-sm font-semibold text-foreground">{admin.name}</div>
                                    <div className="text-xs text-muted-foreground">{admin.email}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {admin.adminRoleName || 'Acceso total'}
                                    </div>
                                    {admin.isSuperAdmin && (
                                      <span className="text-[10px] uppercase tracking-widest text-primary">Superadmin</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRemoveAdmin({ userId: admin.userId, localId: location.id })}
                                      disabled={isAdminSaving}
                                    >
                                      Quitar
                                    </Button>
                                    {adminCounts.get(admin.userId) && adminCounts.get(admin.userId)! > 1 ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveAdmin({ userId: admin.userId, removeFromAll: true })}
                                        disabled={isAdminSaving}
                                      >
                                        Quitar todos
                                      </Button>
                                    ) : null}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground">Sin admins asignados.</p>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="sidebar" className="space-y-6">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Settings2 className="h-4 w-4 text-primary" />
                  Visibilidad del sidebar admin
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="border border-border/60 bg-card/80">
                    <CardHeader>
                      <CardTitle className="text-base">Por marca</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-xs text-muted-foreground">
                        Define las secciones visibles por defecto para todos los locales.
                      </p>
                      <div className="space-y-3">
                        {ADMIN_SECTIONS.map((section) => {
                          const isRequired = isAdminSectionRequired(section.key);
                          const isVisible = isAdminSectionVisible(brandConfig, section.key);
                          return (
                            <div
                              key={section.key}
                              className="border border-border/60 rounded-xl p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div>
                                <div className="text-sm font-semibold text-foreground">{section.label}</div>
                                <p className="text-xs text-muted-foreground">{section.description}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {isRequired && (
                                  <span className="text-[10px] uppercase tracking-widest text-primary">Obligatorio</span>
                                )}
                                <Switch
                                  checked={isVisible}
                                  disabled={isRequired}
                                  onCheckedChange={(checked) =>
                                    updateSidebarVisibility(setBrandConfig, section.key, checked)
                                  }
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border border-border/60 bg-card/80">
                    <CardHeader>
                      <CardTitle className="text-base">Por local</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedBrand.locations?.length ? (
                        <>
                          <div className="space-y-2">
                            <Label>Local a configurar</Label>
                            <Select value={selectedLocationId || undefined} onValueChange={setSelectedLocationId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona local" />
                              </SelectTrigger>
                              <SelectContent>
                                {selectedBrand.locations?.map((location: any) => (
                                  <SelectItem key={location.id} value={location.id}>
                                    {location.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={isLocationSidebarOverride}
                              onCheckedChange={handleLocationSidebarOverride}
                            />
                            <span className="text-sm text-muted-foreground">
                              Personalizar visibilidad para este local
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Si está desactivado, el local hereda la configuración de la marca.
                          </p>
                          <div className="space-y-3">
                            {ADMIN_SECTIONS.map((section) => {
                              const isRequired = isAdminSectionRequired(section.key);
                              const isVisible = isAdminSectionVisible(locationSidebarConfig, section.key);
                              return (
                                <div
                                  key={section.key}
                                  className="border border-border/60 rounded-xl p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div>
                                    <div className="text-sm font-semibold text-foreground">{section.label}</div>
                                    <p className="text-xs text-muted-foreground">{section.description}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isRequired && (
                                      <span className="text-[10px] uppercase tracking-widest text-primary">Obligatorio</span>
                                    )}
                                    <Switch
                                      checked={isVisible}
                                      disabled={!isLocationSidebarOverride || isRequired}
                                      onCheckedChange={(checked) =>
                                        updateSidebarVisibility(setLocationConfig, section.key, checked)
                                      }
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Crea al menos un local para configurar su menú.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveBrand} disabled={isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar cambios
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="landing" className="space-y-6">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <LayoutTemplate className="h-4 w-4 text-primary" />
                  Secciones de la landing
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="border border-border/60 bg-card/80">
                    <CardHeader>
                      <CardTitle className="text-base">Por marca</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-xs text-muted-foreground">
                        Organiza el orden general. El hero siempre se muestra primero.
                      </p>
                      <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                        Hero (cabecera principal) · fijo en la primera posición
                      </div>
                      <div className="space-y-3">
                        {brandLandingItems.map((item, index) => {
                          const meta = LANDING_SECTION_META[item.key];
                          const Icon = meta.icon;
                          const isDragging = draggingLandingScope === 'brand' && draggingLandingKey === item.key;
                          const isDragOver = draggingLandingScope === 'brand' && dragOverLandingIndex === index && !isDragging;
                          return (
                            <div
                              key={item.key}
                              draggable
                              onDragStart={(event) => handleLandingDragStart(event, index, 'brand')}
                              onDragOver={(event) => handleLandingDragOver(event, index, 'brand')}
                              onDrop={(event) => handleLandingDrop(setBrandConfig, brandLandingItems, event, index)}
                              onDragEnd={handleLandingDragEnd}
                              data-section-key={item.key}
                              className={`relative border border-border/60 rounded-xl p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between transition-all duration-200 select-none cursor-grab active:cursor-grabbing ${
                                isDragging ? 'bg-primary/10 border-primary/40 shadow-lg scale-[0.99]' : ''
                              } ${
                                isDragOver
                                  ? 'ring-2 ring-primary/30 bg-primary/5 before:absolute before:inset-x-3 before:-top-px before:h-[2px] before:bg-primary/60 before:rounded-full'
                                  : ''
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <GripVertical className={`h-4 w-4 mt-1 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                                <div className="flex items-start gap-3">
                                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                    <Icon className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <div className="text-sm font-semibold text-foreground">{meta.label}</div>
                                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                                  </div>
                                </div>
                              </div>
                              <Switch
                                checked={item.enabled}
                                onCheckedChange={(checked) =>
                                  handleLandingToggle(setBrandConfig, brandLandingItems, item.key, checked)
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                      <div className="pt-4 border-t border-border/60 space-y-3">
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">Imágenes landing</p>
                        <div className="grid gap-4">
                          {renderBrandAssetInput('heroBackground')}
                          {renderBrandAssetInput('heroImage')}
                          {renderBrandAssetInput('signImage')}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border border-border/60 bg-card/80">
                    <CardHeader>
                      <CardTitle className="text-base">Por local</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedBrand.locations?.length ? (
                        <>
                          <div className="space-y-2">
                            <Label>Local a configurar</Label>
                            <Select value={selectedLocationId || undefined} onValueChange={setSelectedLocationId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona local" />
                              </SelectTrigger>
                              <SelectContent>
                                {selectedBrand.locations?.map((location: any) => (
                                  <SelectItem key={location.id} value={location.id}>
                                    {location.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={isLocationLandingOverride}
                              onCheckedChange={handleLocationLandingOverride}
                            />
                            <span className="text-sm text-muted-foreground">
                              Personalizar landing para este local
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Si está desactivado, el local hereda el orden y visibilidad de la marca.
                          </p>
                          <div
                            className={`rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm ${
                              isLocationLandingOverride ? 'text-muted-foreground' : 'text-muted-foreground/70'
                            }`}
                          >
                            Hero (cabecera principal) · fijo en la primera posición
                          </div>
                          <div className="space-y-3">
                            {locationLandingItems.map((item, index) => {
                              const meta = LANDING_SECTION_META[item.key];
                              const Icon = meta.icon;
                              const isDisabled = !isLocationLandingOverride;
                              const isDragging = draggingLandingScope === 'location' && draggingLandingKey === item.key;
                              const isDragOver =
                                draggingLandingScope === 'location' && dragOverLandingIndex === index && !isDragging;
                              return (
                                <div
                                  key={item.key}
                                  draggable={!isDisabled}
                                  onDragStart={(event) => {
                                    if (!isDisabled) handleLandingDragStart(event, index, 'location');
                                  }}
                                  onDragOver={(event) => {
                                    if (!isDisabled) handleLandingDragOver(event, index, 'location');
                                  }}
                                  onDrop={(event) => {
                                    if (!isDisabled) {
                                      handleLandingDrop(setLocationConfig, locationLandingItems, event, index);
                                    }
                                  }}
                                  onDragEnd={handleLandingDragEnd}
                                  data-section-key={item.key}
                                  className={`relative border border-border/60 rounded-xl p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between transition-all duration-200 ${
                                    isDisabled ? 'opacity-60 cursor-not-allowed' : 'select-none cursor-grab active:cursor-grabbing'
                                  } ${!isDisabled && isDragging ? 'bg-primary/10 border-primary/40 shadow-lg scale-[0.99]' : ''} ${
                                    !isDisabled && isDragOver
                                      ? 'ring-2 ring-primary/30 bg-primary/5 before:absolute before:inset-x-3 before:-top-px before:h-[2px] before:bg-primary/60 before:rounded-full'
                                      : ''
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <GripVertical className={`h-4 w-4 mt-1 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                                    <div className="flex items-start gap-3">
                                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                        <Icon className="h-4 w-4" />
                                      </div>
                                      <div>
                                        <div className="text-sm font-semibold text-foreground">{meta.label}</div>
                                        <p className="text-xs text-muted-foreground">{meta.description}</p>
                                      </div>
                                    </div>
                                  </div>
                                  <Switch
                                    checked={item.enabled}
                                    disabled={isDisabled}
                                    onCheckedChange={(checked) =>
                                      handleLandingToggle(setLocationConfig, locationLandingItems, item.key, checked)
                                    }
                                  />
                                </div>
                              );
                            })}
                          </div>
                          <div className="pt-4 border-t border-border/60 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs uppercase tracking-widest text-muted-foreground">Imágenes landing</p>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Personalizar</span>
                                <Switch
                                  checked={isLocationBrandingOverride}
                                  onCheckedChange={handleLocationLandingImagesOverride}
                                />
                              </div>
                            </div>
                            <div className={`grid gap-4 ${isLocationBrandingOverride ? '' : 'opacity-70'}`}>
                              {renderLocationAssetInput('heroBackground', {
                                disabled: !isLocationBrandingOverride,
                                inheritedLabel: 'Hereda marca',
                              })}
                              {renderLocationAssetInput('heroImage', {
                                disabled: !isLocationBrandingOverride,
                                inheritedLabel: 'Hereda marca',
                              })}
                              {renderLocationAssetInput('signImage', {
                                disabled: !isLocationBrandingOverride,
                                inheritedLabel: 'Hereda marca',
                              })}
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Selecciona una marca con locales activos.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveBrand} disabled={isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar cambios
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="config" className="space-y-6">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Settings2 className="h-4 w-4 text-primary" />
                  Configuración por marca y local
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="border border-border/60 bg-card/80">
                    <CardHeader>
                      <CardTitle className="text-base">Brand config</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-3">
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">General</p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Superadmin email</Label>
                            <Input
                              value={brandConfig.superAdminEmail || ''}
                              onChange={(e) => setBrandConfig((prev) => ({ ...prev, superAdminEmail: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Brand short name</Label>
                            <Input
                              value={brandConfig.branding?.shortName || ''}
                              onChange={(e) =>
                                setBrandConfig((prev) => updateNestedValue(prev, ['branding', 'shortName'], e.target.value))
                              }
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label>Brand name</Label>
                            <Input
                              value={brandConfig.branding?.name || ''}
                              onChange={(e) =>
                                setBrandConfig((prev) => updateNestedValue(prev, ['branding', 'name'], e.target.value))
                              }
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label>Color corporativo</Label>
                            <div className="flex flex-col sm:flex-row gap-3">
                              <Input
                                type="color"
                                value={colorPickerValue(brandConfig.theme?.primary)}
                                onChange={(e) =>
                                  setBrandConfig((prev) =>
                                    updateNestedValue(prev, ['theme', 'primary'], normalizeHexInput(e.target.value))
                                  )
                                }
                                className="h-10 w-full sm:w-16 p-1"
                              />
                              <Input
                                value={brandConfig.theme?.primary || ''}
                                placeholder="#fcbc23"
                                onChange={(e) =>
                                  setBrandConfig((prev) =>
                                    updateNestedValue(prev, ['theme', 'primary'], normalizeHexInput(e.target.value))
                                  )
                                }
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Las variantes se calculan automáticamente a partir del color base.
                            </p>
                          </div>
                          {renderBrandAssetInput('logo', 'md:col-span-2')}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">Notificaciones (perfil)</p>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                            <div>
                              <div className="text-sm font-semibold text-foreground">Email</div>
                              <p className="text-xs text-muted-foreground">Mostrar opción de correo en el perfil.</p>
                            </div>
                            <Switch
                              checked={brandNotificationPrefs.email}
                              onCheckedChange={(checked) =>
                                setBrandConfig((prev) => updateNestedValue(prev, ['notificationPrefs', 'email'], checked))
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                            <div>
                              <div className="text-sm font-semibold text-foreground">WhatsApp</div>
                              <p className="text-xs text-muted-foreground">Mostrar opción de WhatsApp en el perfil.</p>
                            </div>
                            <Switch
                              checked={brandNotificationPrefs.whatsapp}
                              onCheckedChange={(checked) =>
                                setBrandConfig((prev) => updateNestedValue(prev, ['notificationPrefs', 'whatsapp'], checked))
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                            <div>
                              <div className="text-sm font-semibold text-foreground">SMS</div>
                              <p className="text-xs text-muted-foreground">Mostrar opción de SMS en el perfil.</p>
                            </div>
                            <Switch
                              checked={brandNotificationPrefs.sms}
                              onCheckedChange={(checked) =>
                                setBrandConfig((prev) => updateNestedValue(prev, ['notificationPrefs', 'sms'], checked))
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">ImageKit</p>
                        <div className="space-y-2">
                          <Label>Subcarpeta (opcional)</Label>
                          <Input
                            value={brandConfig.imagekit?.folder || ''}
                            placeholder="landing"
                            onChange={(e) =>
                              setBrandConfig((prev) => updateNestedValue(prev, ['imagekit', 'folder'], e.target.value))
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            Se antepone automáticamente el prefijo global y el subdominio de la marca.
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Ruta final:{' '}
                            <span className="font-mono text-foreground">
                              {buildImagekitPreview(
                                imagekitPrefix,
                                selectedBrand?.subdomain,
                                brandConfig.imagekit?.folder || '',
                              )}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">Email SMTP</p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Usuario</Label>
                            <Input
                              value={brandConfig.email?.user || ''}
                              onChange={(e) => setBrandConfig((prev) => updateNestedValue(prev, ['email', 'user'], e.target.value))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Password</Label>
                            <Input
                              type="password"
                              value={brandConfig.email?.password || ''}
                              onChange={(e) => setBrandConfig((prev) => updateNestedValue(prev, ['email', 'password'], e.target.value))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Host</Label>
                            <Input
                              value={brandConfig.email?.host || ''}
                              onChange={(e) => setBrandConfig((prev) => updateNestedValue(prev, ['email', 'host'], e.target.value))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Puerto</Label>
                            <Input
                              value={brandConfig.email?.port || ''}
                              onChange={(e) => setBrandConfig((prev) => updateNestedValue(prev, ['email', 'port'], e.target.value))}
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label>From name</Label>
                            <Input
                              value={brandConfig.email?.fromName || ''}
                              onChange={(e) => setBrandConfig((prev) => updateNestedValue(prev, ['email', 'fromName'], e.target.value))}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">Twilio</p>
                        <div className="space-y-2">
                          <Label>Alphanumeric sender ID</Label>
                          <Input
                            placeholder="LEBLOND"
                            value={brandConfig.twilio?.smsSenderId || ''}
                            onChange={(e) =>
                              setBrandConfig((prev) => updateNestedValue(prev, ['twilio', 'smsSenderId'], e.target.value))
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            Define el remitente por marca.
                          </p>
                        </div>
                      </div>

                    </CardContent>
                  </Card>

                  <Card className="border border-border/60 bg-card/80">
                    <CardHeader>
                      <CardTitle className="text-base">Local config</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Local a configurar</Label>
                        <Select value={selectedLocationId || undefined} onValueChange={setSelectedLocationId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona local" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedBrand?.locations?.map((location: any) => (
                              <SelectItem key={location.id} value={location.id}>
                                {location.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Cambia de local aquí para editar su color e ImageKit.
                        </p>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-foreground">Notificaciones en perfil</p>
                            <p className="text-xs text-muted-foreground">
                              Sobrescribe las opciones visibles para este local.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Personalizar</span>
                            <Switch
                              checked={isLocationNotificationOverride}
                              onCheckedChange={handleLocationNotificationOverride}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                            <div>
                              <div className="text-sm font-semibold text-foreground">Email</div>
                              <p className="text-xs text-muted-foreground">Visible para clientes.</p>
                            </div>
                            <Switch
                              checked={locationNotificationPrefs.email}
                              disabled={!isLocationNotificationOverride}
                              onCheckedChange={(checked) =>
                                setLocationConfig((prev) => updateNestedValue(prev, ['notificationPrefs', 'email'], checked))
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                            <div>
                              <div className="text-sm font-semibold text-foreground">WhatsApp</div>
                              <p className="text-xs text-muted-foreground">Visible para clientes.</p>
                            </div>
                            <Switch
                              checked={locationNotificationPrefs.whatsapp}
                              disabled={!isLocationNotificationOverride}
                              onCheckedChange={(checked) =>
                                setLocationConfig((prev) => updateNestedValue(prev, ['notificationPrefs', 'whatsapp'], checked))
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                            <div>
                              <div className="text-sm font-semibold text-foreground">SMS</div>
                              <p className="text-xs text-muted-foreground">Visible para clientes.</p>
                            </div>
                            <Switch
                              checked={locationNotificationPrefs.sms}
                              disabled={!isLocationNotificationOverride}
                              onCheckedChange={(checked) =>
                                setLocationConfig((prev) => updateNestedValue(prev, ['notificationPrefs', 'sms'], checked))
                              }
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Color local (opcional)</Label>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Input
                            type="color"
                            value={colorPickerValue(locationConfig.theme?.primary)}
                            onChange={(e) =>
                              setLocationConfig((prev) =>
                                updateNestedValue(prev, ['theme', 'primary'], normalizeHexInput(e.target.value))
                              )
                            }
                            className="h-10 w-full sm:w-16 p-1"
                          />
                          <Input
                            value={locationConfig.theme?.primary || ''}
                            placeholder="#fcbc23"
                            onChange={(e) =>
                              setLocationConfig((prev) =>
                                updateNestedValue(prev, ['theme', 'primary'], normalizeHexInput(e.target.value))
                              )
                            }
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Si se define, sobrescribe el color de la marca.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Subcarpeta local (opcional)</Label>
                        <Input
                          value={locationConfig.imagekit?.folder || ''}
                          placeholder="landing"
                          onChange={(e) =>
                            setLocationConfig((prev) => updateNestedValue(prev, ['imagekit', 'folder'], e.target.value))
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Ruta final:{' '}
                          <span className="font-mono text-foreground">
                            {buildImagekitPreview(
                              imagekitPrefix,
                              selectedBrand?.subdomain,
                              locationConfig.imagekit?.folder || '',
                            )}
                          </span>
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Nota</Label>
                        <p className="text-xs text-muted-foreground">
                          Si se define, sobrescribe el de la marca. El prefijo global y el subdominio se añaden automáticamente.
                        </p>
                      </div>
                      <div className="flex items-center gap-3 pt-2">
                        <Switch
                          checked={applyThemeToAll}
                          onCheckedChange={(checked) => setApplyThemeToAll(checked)}
                        />
                        <span className="text-sm text-muted-foreground">
                          Aplicar este color a todos los locales de la marca
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveBrand} disabled={isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar cambios
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="legal" className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Settings2 className="h-4 w-4 text-primary" />
                    Legal y DPA por marca
                  </div>
                  <Button onClick={handleSaveLegal} disabled={isLegalSaving || isLegalLoading || !legalSettings}>
                    {(isLegalSaving || isLegalLoading) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Save className="h-4 w-4 mr-2" />
                    Guardar legal
                  </Button>
                </div>

                {isLegalLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cargando informacion legal...
                  </div>
                )}

                {!legalSettings && !isLegalLoading && (
                  <Card className="border border-border/60 bg-card/70">
                    <CardContent className="text-sm text-muted-foreground">
                      No hay datos legales disponibles para esta marca.
                    </CardContent>
                  </Card>
                )}

                {legalSettings && (
                  <>
                    <Card className="border border-border/60 bg-card/80">
                      <CardHeader>
                        <CardTitle className="text-base">Datos legales</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Nombre legal</Label>
                          <Input
                            value={legalSettings.legalOwnerName || ''}
                            onChange={(e) => updateLegalField('legalOwnerName', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>NIF/CIF</Label>
                          <Input
                            value={legalSettings.legalOwnerTaxId || ''}
                            onChange={(e) => updateLegalField('legalOwnerTaxId', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>Direccion</Label>
                          <Input
                            value={legalSettings.legalOwnerAddress || ''}
                            onChange={(e) => updateLegalField('legalOwnerAddress', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input
                            value={legalSettings.legalContactEmail || ''}
                            onChange={(e) => updateLegalField('legalContactEmail', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Telefono</Label>
                          <Input
                            value={legalSettings.legalContactPhone || ''}
                            onChange={(e) => updateLegalField('legalContactPhone', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Pais</Label>
                          <Input
                            value={legalSettings.country}
                            onChange={(e) => updateLegalField('country', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Retencion (dias)</Label>
                          <Input
                            type="number"
                            min={1}
                            value={legalSettings.retentionDays ?? ''}
                            onChange={(e) =>
                              updateLegalField('retentionDays', e.target.value ? Number(e.target.value) : null)
                            }
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-border/60 bg-card/80">
                      <CardHeader>
                        <CardTitle className="text-base">Transparencia e IA</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <Label>Mostrar disclosure de IA</Label>
                            <p className="text-xs text-muted-foreground">Se mostrara en la Politica de Privacidad.</p>
                          </div>
                          <Switch
                            checked={legalSettings.aiDisclosureEnabled}
                            onCheckedChange={(value) => updateLegalField('aiDisclosureEnabled', value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Proveedores de IA (separados por coma)</Label>
                          <Input
                            value={aiProvidersInput}
                            onChange={(e) => setAiProvidersInput(e.target.value)}
                            placeholder="OpenAI, ..."
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-border/60 bg-card/80">
                      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <CardTitle className="text-base">Subprocesadores</CardTitle>
                        <Button variant="outline" size="sm" onClick={addLegalSubProcessor}>
                          <Plus className="h-4 w-4 mr-2" />
                          Anadir
                        </Button>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {(legalSettings.subProcessors || []).length === 0 ? (
                          <p className="text-sm text-muted-foreground">Sin subprocesadores configurados.</p>
                        ) : (
                          legalSettings.subProcessors.map((processor, index) => (
                            <div key={`${processor.name}-${index}`} className="rounded-xl border border-border/60 p-4 space-y-3">
                              <div className="grid md:grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <Label>Nombre</Label>
                                  <Input
                                    value={processor.name}
                                    onChange={(e) => updateLegalSubProcessor(index, 'name', e.target.value)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Pais</Label>
                                  <Input
                                    value={processor.country}
                                    onChange={(e) => updateLegalSubProcessor(index, 'country', e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label>Finalidad</Label>
                                <Input
                                  value={processor.purpose}
                                  onChange={(e) => updateLegalSubProcessor(index, 'purpose', e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Tipos de datos</Label>
                                <Input
                                  value={processor.dataTypes}
                                  onChange={(e) => updateLegalSubProcessor(index, 'dataTypes', e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Enlace</Label>
                                <Input
                                  value={processor.link || ''}
                                  onChange={(e) => updateLegalSubProcessor(index, 'link', e.target.value)}
                                />
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => removeLegalSubProcessor(index)}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </Button>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border border-border/60 bg-card/80">
                      <CardHeader>
                        <CardTitle className="text-base">Secciones personalizadas</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {(['privacy', 'cookies', 'notice', 'dpa'] as const).map((pageKey) => (
                          <div key={pageKey} className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-lg font-semibold text-foreground">
                                  {pageKey === 'privacy' && 'Privacidad'}
                                  {pageKey === 'cookies' && 'Cookies'}
                                  {pageKey === 'notice' && 'Aviso legal'}
                                  {pageKey === 'dpa' && 'DPA'}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                  Secciones adicionales que se mostraran al final de la pagina.
                                </p>
                              </div>
                              <Button variant="outline" size="sm" onClick={() => addLegalCustomSection(pageKey)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Anadir seccion
                              </Button>
                            </div>
                            {(legalCustomSections[pageKey] || []).length === 0 ? (
                              <p className="text-sm text-muted-foreground">Sin secciones adicionales.</p>
                            ) : (
                              (legalCustomSections[pageKey] || []).map((section, index) => (
                                <div key={`${pageKey}-${index}`} className="rounded-xl border border-border/60 p-4 space-y-3">
                                  <div className="space-y-2">
                                    <Label>Titulo</Label>
                                    <Input
                                      value={section.heading}
                                      onChange={(e) => updateLegalCustomSection(pageKey, index, 'heading', e.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Contenido (Markdown)</Label>
                                    <Textarea
                                      className="min-h-[120px]"
                                      value={section.bodyMarkdown}
                                      onChange={(e) => updateLegalCustomSection(pageKey, index, 'bodyMarkdown', e.target.value)}
                                    />
                                  </div>
                                  <Button variant="ghost" size="sm" onClick={() => removeLegalCustomSection(pageKey, index)}>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Eliminar
                                  </Button>
                                </div>
                              ))
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="border border-border/60 bg-card/80">
                      <CardHeader>
                        <CardTitle className="text-base">Versiones de politicas</CardTitle>
                      </CardHeader>
                      <CardContent className="grid md:grid-cols-3 gap-4">
                        <div className="rounded-xl border border-border/60 p-4 space-y-2">
                          <p className="text-sm text-muted-foreground">Privacidad</p>
                          <p className="text-2xl font-semibold text-foreground">v{legalSettings.privacyPolicyVersion}</p>
                          <Button variant="outline" size="sm" onClick={() => setBumpTarget('privacy')}>
                            <RefreshCcw className="h-4 w-4 mr-2" />
                            Subir version
                          </Button>
                        </div>
                        <div className="rounded-xl border border-border/60 p-4 space-y-2">
                          <p className="text-sm text-muted-foreground">Cookies</p>
                          <p className="text-2xl font-semibold text-foreground">v{legalSettings.cookiePolicyVersion}</p>
                          <Button variant="outline" size="sm" onClick={() => setBumpTarget('cookies')}>
                            <RefreshCcw className="h-4 w-4 mr-2" />
                            Subir version
                          </Button>
                        </div>
                        <div className="rounded-xl border border-border/60 p-4 space-y-2">
                          <p className="text-sm text-muted-foreground">Aviso legal</p>
                          <p className="text-2xl font-semibold text-foreground">v{legalSettings.legalNoticeVersion}</p>
                          <Button variant="outline" size="sm" onClick={() => setBumpTarget('notice')}>
                            <RefreshCcw className="h-4 w-4 mr-2" />
                            Subir version
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-border/60 bg-card/80">
                      <CardHeader>
                        <CardTitle className="text-base">DPA / Encargo de tratamiento</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {dpaContent ? (
                          <>
                            <div className="text-sm text-muted-foreground">
                              Version {dpaContent.version} · Vigente desde {dpaContent.effectiveDate}
                            </div>
                            <div className="space-y-4">
                              {dpaContent.sections.map((section) => (
                                <div key={section.heading} className="space-y-2">
                                  <h3 className="text-base font-semibold text-foreground">{section.heading}</h3>
                                  <MarkdownContent markdown={section.bodyMarkdown} />
                                </div>
                              ))}
                            </div>
                            {dpaContent.subProcessors && dpaContent.subProcessors.length > 0 && (
                              <div className="pt-4 border-t border-border/60 space-y-2">
                                <h3 className="text-base font-semibold text-foreground">Subprocesadores incluidos</h3>
                                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                                  {dpaContent.subProcessors.map((processor) => (
                                    <li key={processor.name}>{processor.name} · {processor.purpose}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">No hay DPA generado todavía.</p>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}

                {legalSettings && (
                  <AlertDialog open={Boolean(bumpTarget)} onOpenChange={(open) => !open && setBumpTarget(null)}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Subir version?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta accion incrementa la version y se aplicara a nuevos consentimientos.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleVersionBump}>Confirmar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-border/60 bg-card/70 flex items-center justify-center h-full">
          <CardContent className="text-muted-foreground">Selecciona una marca para editar.</CardContent>
        </Card>
      )}

      <Dialog open={createBrandOpen} onOpenChange={setCreateBrandOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva marca</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={newBrandForm.name} onChange={(e) => setNewBrandForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Subdominio</Label>
              <Input value={newBrandForm.subdomain} onChange={(e) => setNewBrandForm((prev) => ({ ...prev, subdomain: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Dominio personalizado</Label>
              <Input value={newBrandForm.customDomain} onChange={(e) => setNewBrandForm((prev) => ({ ...prev, customDomain: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={newBrandForm.isActive}
                onCheckedChange={(checked) => setNewBrandForm((prev) => ({ ...prev, isActive: checked }))}
              />
              <span className="text-sm text-muted-foreground">Marca activa</span>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateBrand} disabled={isSaving}>
              Crear marca
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createLocationOpen} onOpenChange={setCreateLocationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo local</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={newLocationForm.name} onChange={(e) => setNewLocationForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={newLocationForm.slug} onChange={(e) => setNewLocationForm((prev) => ({ ...prev, slug: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={newLocationForm.isActive}
                onCheckedChange={(checked) => setNewLocationForm((prev) => ({ ...prev, isActive: checked }))}
              />
              <span className="text-sm text-muted-foreground">Local activo</span>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateLocation}>Crear local</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editLocationOpen} onOpenChange={setEditLocationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar local</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={editLocationForm.name}
                onChange={(e) => setEditLocationForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={editLocationForm.slug}
                onChange={(e) => setEditLocationForm((prev) => ({ ...prev, slug: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={editLocationForm.isActive}
                onCheckedChange={(checked) => setEditLocationForm((prev) => ({ ...prev, isActive: checked }))}
              />
              <span className="text-sm text-muted-foreground">Local activo</span>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (!editingLocationId) return;
                handleUpdateLocation(editingLocationId, {
                  name: editLocationForm.name,
                  slug: editLocationForm.slug || null,
                  isActive: editLocationForm.isActive,
                });
                setEditLocationOpen(false);
              }}
            >
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlatformBrands;
