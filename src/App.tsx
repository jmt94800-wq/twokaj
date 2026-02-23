import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Plus, 
  User as UserIcon, 
  MapPin, 
  Calendar, 
  ArrowRightLeft, 
  Filter,
  X,
  ChevronRight,
  LogOut,
  Clock,
  Share2,
  Globe,
  Wifi
} from 'lucide-react';
import { Message, Category, User, Ad, GalleryImage, CATEGORIES, MONTHS, DAYS } from './types';
import { MessageSquare, CheckCircle2, XCircle, Send, Languages } from 'lucide-react';
import * as db from './db';
import { translations, Language } from './translations';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [showRegister, setShowRegister] = useState(false);
  const [showCreateAd, setShowCreateAd] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [filters, setFilters] = useState({
    category: '',
    city: '',
    date: ''
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [adMessages, setAdMessages] = useState<Message[]>([]);
  const [messageContent, setMessageContent] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [userMessages, setUserMessages] = useState<Message[]>([]);
  const [replyToUser, setReplyToUser] = useState<{id: number, pseudo: string} | null>(null);
  const [lang, setLang] = useState<Language>('fr');

  const t = translations[lang];

  const appUrl = window.location.origin;

  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);

    // Listen for SW messages
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SYNC_REQUIRED') {
        processSyncQueue();
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);

    // Initial load from DB
    const loadFromDB = async () => {
      const cachedAds = await db.getAds();
      if (cachedAds.length > 0) setAds(cachedAds as Ad[]);
      
      // We don't have a reliable way to get the specific user without ID, 
      // but db.getUser() returns the first one found in the store
      const cachedUser = await db.getUser();
      if (cachedUser) setUser(cachedUser as User);
    };
    loadFromDB();

    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  }, []);

  const processSyncQueue = async () => {
    if (!navigator.onLine) return;
    const queue = await db.getSyncQueue();
    for (const action of queue) {
      try {
        let success = false;
        if (action.type === 'CREATE_AD') {
          const res = await fetch('/api/ads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action.payload)
          });
          success = res.ok;
        } else if (action.type === 'SEND_MESSAGE') {
          const res = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action.payload)
          });
          success = res.ok;
        } else if (action.type === 'REGISTER_USER') {
          const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action.payload)
          });
          if (res.ok) {
            const data = await res.json();
            const updatedUser = { ...action.payload, id: data.id };
            setUser(updatedUser);
            await db.saveUser(updatedUser);
            success = true;
          }
        }

        if (success) {
          await db.removeFromSyncQueue(action.id!);
        }
      } catch (e) {
        console.error('Sync failed for action', action, e);
      }
    }
    fetchAds();
  };

  useEffect(() => {
    if (isOnline) {
      processSyncQueue();
    }
  }, [isOnline]);

  // Registration form state
  const [regForm, setRegForm] = useState({
    name: '',
    pseudo: '',
    address: '',
    city: '',
    phone: '',
    image_data: '',
    password: ''
  });

  // Ad form state
  const [adForm, setAdForm] = useState({
    type: 'offer' as 'offer' | 'request',
    category: CATEGORIES[0],
    title: '',
    description: '',
    exchange_category: CATEGORIES[0],
    start_date: '',
    end_date: '',
    is_all_year: false,
    availability_details: '',
    image_data: ''
  });

  const resizeImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: 'reg' | 'ad') => {
    const file = e.target.files?.[0];
    if (!file || !isOnline) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const resized = await resizeImage(reader.result as string);
      if (target === 'reg') {
        setRegForm({ ...regForm, image_data: resized });
      } else {
        setAdForm({ ...adForm, image_data: resized });
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    fetchAds();
    fetchGallery();
  }, [filters]);

  const fetchGallery = async () => {
    try {
      const res = await fetch('/api/gallery');
      if (res.ok) {
        const data = await res.json();
        setGallery(data);
      }
    } catch (e) {
      console.error('Failed to fetch gallery', e);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const resized = await resizeImage(reader.result as string);
      const res = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_data: resized, caption: '' })
      });
      if (res.ok) {
        fetchGallery();
      }
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Miam-Miam - Troc Agricole en Haïti',
        text: 'Rejoignez la plateforme de troc agricole solidaire en Haïti !',
        url: appUrl,
      });
    } else {
      navigator.clipboard.writeText(appUrl);
      alert(t.alerts.appLinkCopied);
    }
  };

  const handleShareAd = (ad: Ad) => {
    const shareText = `${ad.type === 'offer' ? t.adTypes.offer : t.adTypes.request} : ${ad.title}\n${ad.description}\n\nRetrouvez cette annonce sur Miam-Miam !`;
    const shareUrl = `${appUrl}?ad=${ad.id}`;

    if (navigator.share) {
      navigator.share({
        title: `Miam-Miam - ${ad.title}`,
        text: shareText,
        url: shareUrl,
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert(t.alerts.adLinkCopied);
    }
  };

  const fetchAdMessages = async (adId: number) => {
    if (!user) return;
    const res = await fetch(`/api/messages/ad/${adId}?userId=${user.id}`);
    if (res.ok) {
      const data = await res.json();
      setAdMessages(data);
    }
  };

  const fetchUserMessages = async (userId: number) => {
    const res = await fetch(`/api/messages/user/${userId}`);
    if (res.ok) {
      const data = await res.json();
      setUserMessages(data);
    }
  };

  const handleSendMessage = async (receiverId: number, type: 'normal' | 'deal_accepted' | 'deal_rejected' = 'normal') => {
    if (!user || !selectedAd || (!messageContent && type === 'normal')) return;

    const payload = {
      ad_id: selectedAd.id,
      sender_id: user.id,
      receiver_id: receiverId,
      content: messageContent || (type === 'deal_accepted' ? (lang === 'fr' ? 'Accord conclu !' : 'Akò konkli !') : (lang === 'fr' ? 'Désolé, je ne suis pas intéressé.' : 'Padon, mwen pa enterese.')),
      type
    };

    if (!navigator.onLine) {
      await db.addToSyncQueue({
        type: 'SEND_MESSAGE',
        payload,
        timestamp: Date.now()
      });
      // Register for background sync if possible
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        try {
          await (registration as any).sync.register('sync-miam-miam');
        } catch (e) {
          console.log('Background sync registration failed', e);
        }
      }
      setMessageContent('');
      alert(t.alerts.messageQueued);
      return;
    }

    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      setMessageContent('');
      fetchAdMessages(selectedAd.id);
    }
  };

  const handleCloseAd = async (adId: number) => {
    const res = await fetch(`/api/ads/${adId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' })
    });
    if (res.ok) {
      fetchAds();
      setSelectedAd(null);
    }
  };

  const fetchAds = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/ads?${query}`);
      if (res.ok) {
        const data = await res.json();
        setAds(data);
        db.saveAds(data);
      }
    } catch (e) {
      console.error('Failed to fetch ads, using cache', e);
      const cachedAds = await db.getAds();
      if (cachedAds.length > 0) setAds(cachedAds as Ad[]);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!navigator.onLine) {
      // Offline registration
      const tempId = Date.now(); // Temporary ID
      const newUser = { ...regForm, id: tempId };
      setUser(newUser);
      db.saveUser(newUser);
      
      await db.addToSyncQueue({
        type: 'REGISTER_USER',
        payload: regForm,
        timestamp: Date.now()
      });

      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        try {
          await (registration as any).sync.register('sync-miam-miam');
        } catch (e) {
          console.log('Background sync registration failed', e);
        }
      }

      setShowRegister(false);
      alert(t.alerts.registerQueued);
      return;
    }

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regForm)
    });
    if (res.ok) {
      const data = await res.json();
      const newUser = { ...regForm, id: data.id };
      setUser(newUser);
      db.saveUser(newUser);
      setShowRegister(false);
    } else {
      const err = await res.json();
      alert(t.alerts.registerError);
    }
  };

  const handleLogin = async (pseudo: string, password?: string) => {
    if (!navigator.onLine) {
      // Try to login with cached user
      const cachedUser = await db.getUser();
      if (cachedUser && cachedUser.pseudo === pseudo) {
        // In a real app we'd check the password here too
        setUser(cachedUser);
        setShowRegister(false);
        return;
      }
      alert(t.alerts.loginOfflineError);
      return;
    }

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pseudo, password })
    });
    if (res.ok) {
      const data = await res.json();
      setUser(data);
      db.saveUser(data);
      setShowRegister(false);
    } else {
      alert(t.alerts.loginError);
    }
  };

  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const payload = { 
      ...adForm, 
      user_id: user.id, 
      description: `${adForm.description}\n\nDisponibilité: ${adForm.availability_details}` 
    };

    if (!navigator.onLine) {
      await db.addToSyncQueue({
        type: 'CREATE_AD',
        payload,
        timestamp: Date.now()
      });
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        try {
          await (registration as any).sync.register('sync-miam-miam');
        } catch (e) {
          console.log('Background sync registration failed', e);
        }
      }
      setShowCreateAd(false);
      alert(t.alerts.adQueued);
      return;
    }

    const res = await fetch('/api/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      setShowCreateAd(false);
      fetchAds();
      setAdForm({
        type: 'offer',
        category: CATEGORIES[0],
        title: '',
        description: '',
        exchange_category: CATEGORIES[0],
        start_date: '',
        end_date: '',
        is_all_year: false,
        availability_details: '',
        image_data: ''
      });
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-stone-50">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-white text-center py-1 text-xs font-bold sticky top-0 z-50 flex items-center justify-center gap-2">
          <Globe size={12} className="animate-pulse" />
          {t.offlineMode}
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-serif text-xl font-bold">M</div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-primary tracking-tight leading-none">{t.appName}</h1>
              <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{t.tagline}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => setLang(lang === 'fr' ? 'ht' : 'fr')}
              className="flex items-center gap-1 px-2 py-1 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-600 transition-colors"
              title="Changer de langue / Chanje lang"
            >
              <Languages size={16} />
              <span className="text-xs font-bold uppercase">{lang === 'fr' ? 'HT' : 'FR'}</span>
            </button>

            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-stone-50 rounded-full border border-stone-100">
              {isOnline ? (
                <Wifi size={14} className="text-emerald-500" />
              ) : (
                <Wifi size={14} className="text-stone-300" />
              )}
              <span className="text-[10px] font-bold uppercase text-stone-500">
                {isOnline ? (lang === 'fr' ? 'Mode Internet' : 'Mòd Entènèt') : (lang === 'fr' ? 'Mode Local' : 'Mòd Lokal')}
              </span>
            </div>
            
            <button 
              onClick={handleShare}
              className="p-2 hover:bg-stone-100 rounded-full text-stone-500 transition-colors"
              title="Partager l'application"
            >
              <Share2 size={20} />
            </button>

            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-bold leading-tight">{user.pseudo}</p>
                  <p className="text-[10px] text-stone-500 uppercase tracking-wider">{user.city}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => {
                  setShowProfile(true);
                  fetchUserMessages(user.id);
                }}>
                  {user.image_data ? (
                    <img src={user.image_data} alt={user.pseudo} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon size={20} className="text-stone-400" />
                  )}
                </div>
                <button 
                  onClick={() => setUser(null)}
                  className="p-2 hover:bg-stone-100 rounded-full text-stone-500 transition-colors"
                  title={t.logout}
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowRegister(true)}
                className="btn-primary flex items-center gap-2"
              >
                <UserIcon size={18} />
                <span className="hidden sm:inline">{t.login} / {t.register}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Hero & Search */}
        <section className="mb-12 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4 text-stone-800">{lang === 'fr' ? 'Troc Agricole en Haïti' : 'Trok Agrikòl nan Ayiti'}</h2>
          <p className="text-lg text-stone-600 mb-8 max-w-2xl mx-auto">
            {lang === 'fr' 
              ? 'Échangez vos récoltes, votre temps et vos outils. Unissons-nous pour une agriculture solidaire.'
              : 'Chanje rekòt nou, tan nou ak zouti nou. Ann mete tèt nou ansanm pou yon agrikilti solidè.'
            }
          </p>
          
          <div className="card p-2 flex flex-col sm:flex-row gap-2 max-w-3xl mx-auto">
            <div className="flex-1 flex items-center px-4 gap-2 border-b sm:border-b-0 sm:border-r border-stone-100">
              <Filter size={18} className="text-stone-400" />
              <select 
                className="w-full py-3 bg-transparent focus:outline-none text-stone-700"
                value={filters.category}
                onChange={(e) => setFilters({...filters, category: e.target.value})}
              >
                <option value="">{t.allCategories}</option>
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{(t.categories as any)[cat] || cat}</option>)}
              </select>
            </div>
            <div className="flex-1 flex items-center px-4 gap-2 border-b sm:border-b-0 sm:border-r border-stone-100">
              <MapPin size={18} className="text-stone-400" />
              <input 
                type="text" 
                placeholder={t.allCities} 
                className="w-full py-3 bg-transparent focus:outline-none"
                value={filters.city}
                onChange={(e) => setFilters({...filters, city: e.target.value})}
              />
            </div>
            <div className="flex-1 flex items-center px-4 gap-2">
              <Calendar size={18} className="text-stone-400" />
              <input 
                type="date" 
                className="w-full py-3 bg-transparent focus:outline-none"
                value={filters.date}
                onChange={(e) => setFilters({...filters, date: e.target.value})}
              />
            </div>
            <button 
              onClick={fetchAds}
              className="bg-primary text-white p-3 rounded-2xl sm:aspect-square flex items-center justify-center"
            >
              <Search size={20} />
            </button>
          </div>
        </section>

        {/* Ads List */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold">{lang === 'fr' ? 'Annonces récentes' : 'Dènye anons yo'}</h3>
            {user && (
              <button 
                onClick={() => setShowCreateAd(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus size={18} />
                {t.createAd}
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : ads.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {ads.map(ad => (
                <motion.div 
                  key={ad.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => {
                    setSelectedAd(ad);
                    setReplyToUser(null);
                    fetchAdMessages(ad.id);
                  }}
                  className="card p-6 flex flex-col gap-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-stone-100 border border-stone-200 overflow-hidden flex-shrink-0">
                        {ad.user_image ? (
                          <img src={ad.user_image} alt={ad.pseudo} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-400">
                            <UserIcon size={14} />
                          </div>
                        )}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        ad.type === 'offer' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {ad.type === 'offer' ? t.offer : t.request}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-stone-400 font-medium">
                        {new Date(ad.created_at).toLocaleDateString()}
                      </span>
                      <button 
                        onClick={() => handleShareAd(ad)}
                        className="p-1.5 hover:bg-stone-100 rounded-full text-stone-400 transition-colors"
                        title="Partager cette annonce"
                      >
                        <Share2 size={14} />
                      </button>
                    </div>
                  </div>
                  
                  {ad.image_data && (
                    <div className="aspect-video w-full rounded-2xl overflow-hidden border border-stone-100">
                      <img src={ad.image_data} alt={ad.title} className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div>
                    <h4 className="text-xl font-bold mb-1 leading-tight">{ad.title}</h4>
                    <p className="text-stone-600 text-sm line-clamp-2">{ad.description}</p>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm mt-auto pt-4 border-t border-stone-50">
                    <div className="flex items-center gap-1.5 text-stone-500">
                      <UserIcon size={14} />
                      <span className="font-medium">{ad.pseudo}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-stone-500">
                      <MapPin size={14} />
                      <span>{ad.user_city}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-stone-500">
                      <Calendar size={14} />
                      <span>{ad.is_all_year ? t.availableAllYear : `${t.availableFrom} ${new Date(ad.start_date!).toLocaleDateString()} ${t.availableTo} ${new Date(ad.end_date!).toLocaleDateString()}`}</span>
                    </div>
                  </div>

                  <div className="bg-stone-50 p-3 rounded-2xl flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-stone-400">{t.filterCategory}</span>
                      <span className="text-sm font-medium capitalize">{(t.categories as any)[ad.category] || ad.category}</span>
                    </div>
                    <ArrowRightLeft size={16} className="text-stone-300" />
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] uppercase font-bold text-stone-400">{t.exchangeWith}</span>
                      <span className="text-sm font-medium capitalize">{(t.categories as any)[ad.exchange_category] || ad.exchange_category}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-stone-300">
              <p className="text-stone-500">{t.noAds}</p>
            </div>
          )}
        </section>

        {/* Image Gallery */}
        <section className="mt-16 border-t border-stone-200 pt-12">
          <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
            <h3 className="text-2xl font-bold text-center sm:text-left">{lang === 'fr' ? 'La solidarité en images' : 'Solidarite an imaj'}</h3>
            {user && (
              <label className="btn-primary flex items-center gap-2 cursor-pointer text-sm">
                <Plus size={16} />
                {lang === 'fr' ? 'Ajouter une photo' : 'Ajoute yon foto'}
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          {gallery.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {gallery.map((img) => (
                <motion.div 
                  key={img.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="aspect-[3/4] rounded-3xl overflow-hidden shadow-sm border border-stone-200 group relative"
                >
                  <img 
                    src={img.image_data} 
                    alt={img.caption || "Photo de la galerie"} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 opacity-50 grayscale">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-[3/4] rounded-3xl bg-stone-200 animate-pulse" />
              ))}
            </div>
          )}
          
          <p className="text-center text-stone-500 text-sm mt-8 italic max-w-lg mx-auto">
            {lang === 'fr' 
              ? '"M\'ap ede nou fè jaden an pou yon pati nan rekòt la." - Partagez vos moments de solidarité agricole.'
              : '"M ap ede nou fè jaden an pou yon pati nan rekòt la." - Pataje moman solidarite agrikòl nou yo.'
            }
          </p>
        </section>
      </main>

      {/* Ad Detail Modal */}
      <AnimatePresence>
        {selectedAd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-3xl p-8 shadow-2xl relative my-8"
            >
              <button 
                onClick={() => {
                  setSelectedAd(null);
                  setReplyToUser(null);
                }}
                className="absolute top-6 right-6 p-2 hover:bg-stone-100 rounded-full"
              >
                <X size={20} />
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  {selectedAd.image_data && (
                    <img src={selectedAd.image_data} alt={selectedAd.title} className="w-full aspect-video object-cover rounded-2xl" />
                  )}
                  <div>
                    <h3 className="text-3xl font-bold mb-2">{selectedAd.title}</h3>
                    <p className="text-stone-600">{selectedAd.description}</p>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-stone-500">
                      <UserIcon size={14} />
                      <span className="font-medium">{selectedAd.pseudo}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-stone-500">
                      <MapPin size={14} />
                      <span>{selectedAd.user_city}</span>
                    </div>
                  </div>

                  {user && user.id === selectedAd.user_id && (
                    <button 
                      onClick={() => handleCloseAd(selectedAd.id)}
                      className="w-full py-3 rounded-xl bg-stone-100 text-stone-600 font-bold hover:bg-stone-200 transition-colors"
                    >
                      {t.closeAd}
                    </button>
                  )}
                </div>

                <div className="flex flex-col h-[500px] bg-stone-50 rounded-2xl overflow-hidden border border-stone-100">
                  <div className="p-4 border-b border-stone-200 bg-white flex items-center gap-2">
                    <MessageSquare size={18} className="text-stone-400" />
                    <h4 className="font-bold">{lang === 'fr' ? 'Discussions' : 'Diskisyon'}</h4>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {adMessages.length > 0 ? adMessages.map(msg => (
                      <div 
                        key={msg.id} 
                        onClick={() => {
                          if (user && selectedAd && user.id === selectedAd.user_id && msg.sender_id !== user.id) {
                            setReplyToUser({ id: msg.sender_id, pseudo: msg.sender_pseudo || '' });
                          }
                        }}
                        className={`flex flex-col ${msg.sender_id === user?.id ? 'items-end' : 'items-start'} ${
                          user?.id === selectedAd?.user_id && msg.sender_id !== user?.id ? 'cursor-pointer hover:opacity-80' : ''
                        }`}
                      >
                        <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                          replyToUser?.id === msg.sender_id ? 'ring-2 ring-primary ring-offset-1' : ''
                        } ${
                          msg.type === 'deal_accepted' ? 'bg-emerald-100 text-emerald-800' :
                          msg.type === 'deal_rejected' ? 'bg-amber-100 text-amber-800' :
                          msg.sender_id === user?.id ? 'bg-primary text-white' : 'bg-white border border-stone-200 text-stone-700'
                        }`}>
                          <p className="font-bold text-[10px] mb-1 opacity-70">{msg.sender_pseudo}</p>
                          <p>{msg.content}</p>
                        </div>
                        <span className="text-[10px] text-stone-400 mt-1">{new Date(msg.created_at).toLocaleTimeString()}</span>
                      </div>
                    )) : (
                      <div className="h-full flex items-center justify-center text-stone-400 text-sm italic">
                        {lang === 'fr' ? 'Aucun message pour le moment.' : 'Pa gen mesaj pou kounye a.'}
                      </div>
                    )}
                  </div>

                  {user && (
                    <div className="p-4 bg-white border-t border-stone-200 space-y-3">
                      {user.id !== selectedAd.user_id ? (
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder={t.typeMessage}
                            className="input-field flex-1"
                            value={messageContent}
                            onChange={e => setMessageContent(e.target.value)}
                          />
                          <button 
                            onClick={() => handleSendMessage(selectedAd.user_id)}
                            className="p-3 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors"
                          >
                            <Send size={18} />
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {replyToUser ? (
                            <>
                              <div className="flex items-center justify-between bg-stone-100 px-3 py-1.5 rounded-lg text-[10px] font-bold text-stone-500">
                                <span>{lang === 'fr' ? 'Réponse à' : 'Repons pou'} @{replyToUser.pseudo}</span>
                                <button onClick={() => setReplyToUser(null)}><X size={12} /></button>
                              </div>
                              <div className="flex gap-2">
                                <input 
                                  type="text" 
                                  placeholder={`${lang === 'fr' ? 'Répondre à' : 'Reponn'} ${replyToUser.pseudo}...`}
                                  className="input-field flex-1"
                                  value={messageContent}
                                  onChange={e => setMessageContent(e.target.value)}
                                />
                                <button 
                                  onClick={() => handleSendMessage(replyToUser.id)}
                                  className="p-3 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors"
                                >
                                  <Send size={18} />
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <button 
                                  onClick={() => handleSendMessage(replyToUser.id, 'deal_accepted')}
                                  className="flex items-center justify-center gap-2 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-colors"
                                >
                                  <CheckCircle2 size={14} />
                                  {t.dealAccepted}
                                </button>
                                <button 
                                  onClick={() => handleSendMessage(replyToUser.id, 'deal_rejected')}
                                  className="flex items-center justify-center gap-2 py-2 bg-amber-50 text-amber-600 rounded-xl font-bold text-xs hover:bg-amber-100 transition-colors"
                                >
                                  <XCircle size={14} />
                                  {t.dealRejected}
                                </button>
                              </div>
                            </>
                          ) : (
                            <p className="text-[10px] text-stone-400 text-center italic py-2">
                              {lang === 'fr' ? 'Cliquez sur un message pour répondre à un utilisateur.' : 'Klike sou yon mesaj pou reponn yon itilizatè.'}
                            </p>
                          )}
                        </div>
                      )}
                      {user.id !== selectedAd.user_id && !adMessages.some(m => m.sender_id === user.id) && (
                        <button 
                          onClick={() => handleSendMessage(selectedAd.user_id)}
                          className="w-full py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-colors"
                        >
                          {t.contact}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfile && user && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-2xl p-8 shadow-2xl relative my-8"
            >
              <button 
                onClick={() => setShowProfile(false)}
                className="absolute top-6 right-6 p-2 hover:bg-stone-100 rounded-full"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-6 mb-8">
                <div className="w-24 h-24 rounded-full bg-stone-100 border-2 border-stone-200 overflow-hidden">
                  {user.image_data ? (
                    <img src={user.image_data} alt={user.pseudo} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-300">
                      <UserIcon size={40} />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-3xl font-bold">{user.name}</h3>
                  <p className="text-stone-500">@{user.pseudo} • {user.city}</p>
                </div>
              </div>

              <h4 className="font-bold mb-4 border-b pb-2">{lang === 'fr' ? 'Mes Annonces' : 'Anons mwen yo'}</h4>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {ads.filter(a => a.user_id === user.id).length > 0 ? (
                  ads.filter(a => a.user_id === user.id).map(ad => (
                    <div key={ad.id} className="p-4 bg-stone-50 rounded-2xl flex items-center justify-between">
                      <div>
                        <p className="font-bold">{ad.title}</p>
                        <p className="text-xs text-stone-500">{new Date(ad.created_at).toLocaleDateString()}</p>
                      </div>
                      <button 
                        onClick={() => {
                          setSelectedAd(ad);
                          setShowProfile(false);
                          setReplyToUser(null);
                          fetchAdMessages(ad.id);
                        }}
                        className="text-primary text-sm font-bold"
                      >
                        {t.profile.viewDetails}
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-stone-400 italic text-sm">{t.profile.noAds}</p>
                )}
              </div>

              <h4 className="font-bold mb-4 border-b pb-2 mt-8">{t.myMessages}</h4>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {userMessages.length > 0 ? (
                  userMessages.map(msg => (
                    <div key={msg.id} className="p-4 bg-stone-50 rounded-2xl">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-xs font-bold text-primary uppercase">{msg.ad_title}</p>
                        <p className="text-[10px] text-stone-400">{new Date(msg.created_at).toLocaleDateString()}</p>
                      </div>
                      <p className="text-sm font-medium">{t.adCard.from}: {msg.sender_pseudo}</p>
                      <p className="text-sm text-stone-600 line-clamp-1">{msg.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-stone-400 italic text-sm">{t.messages.noMessages}</p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showRegister && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl relative my-auto"
            >
              <button 
                onClick={() => setShowRegister(false)}
                className="absolute top-6 right-6 p-2 hover:bg-stone-100 rounded-full"
              >
                <X size={20} />
              </button>
              
              <h3 className="text-3xl font-bold mb-6">{t.registerTitle}</h3>
              
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="flex justify-center mb-4">
                  <label className="relative cursor-pointer group">
                    <div className="w-20 h-20 rounded-full bg-stone-100 border-2 border-dashed border-stone-300 flex items-center justify-center overflow-hidden transition-colors group-hover:border-emerald-400">
                      {regForm.image_data ? (
                        <img src={regForm.image_data} alt="Aperçu" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center">
                          <Plus size={20} className="mx-auto text-stone-400" />
                          <span className="text-[8px] text-stone-500 font-bold uppercase">{t.login.photo}</span>
                        </div>
                      )}
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={e => handleFileChange(e, 'reg')}
                      disabled={!isOnline}
                    />
                    {!isOnline && (
                      <div className="absolute inset-0 bg-stone-50/80 flex items-center justify-center rounded-full">
                        <Globe size={14} className="text-stone-400" />
                      </div>
                    )}
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">{t.fullName}</label>
                  <input 
                    required
                    type="text" 
                    className="input-field" 
                    placeholder="Jean Dupont"
                    value={regForm.name}
                    onChange={e => setRegForm({...regForm, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">{t.pseudo}</label>
                  <input 
                    required
                    type="text" 
                    className="input-field" 
                    placeholder="jeannot2026"
                    value={regForm.pseudo}
                    onChange={e => setRegForm({...regForm, pseudo: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">{t.password}</label>
                  <input 
                    required
                    type="password" 
                    className="input-field" 
                    placeholder="••••••••"
                    value={regForm.password}
                    onChange={e => setRegForm({...regForm, password: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">{t.city}</label>
                    <input 
                      required
                      type="text" 
                      className="input-field" 
                      placeholder="Aquin"
                      value={regForm.city}
                      onChange={e => setRegForm({...regForm, city: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">{t.phone}</label>
                    <input 
                      type="tel" 
                      className="input-field" 
                      placeholder="+509 ..."
                      value={regForm.phone}
                      onChange={e => setRegForm({...regForm, phone: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">{t.address}</label>
                  <textarea 
                    required
                    className="input-field h-20 resize-none" 
                    placeholder="Rue des Manguiers..."
                    value={regForm.address}
                    onChange={e => setRegForm({...regForm, address: e.target.value})}
                  />
                </div>
                <button type="submit" className="btn-primary w-full py-3 mt-4 text-lg">
                  {t.registerButton}
                </button>
              </form>

              <div className="mt-4 pt-4 border-t border-stone-100 text-center">
                <p className="text-xs text-stone-500 mb-3">{t.alreadyRegistered}</p>
                <div className="space-y-2">
                  <input 
                    type="text" 
                    id="login-pseudo"
                    placeholder={t.pseudo} 
                    className="input-field w-full py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <input 
                      type="password" 
                      id="login-password"
                      placeholder={t.login.password} 
                      className="input-field flex-1 py-2 text-sm"
                    />
                    <button 
                      onClick={() => {
                        const pseudo = (document.getElementById('login-pseudo') as HTMLInputElement).value;
                        const pass = (document.getElementById('login-password') as HTMLInputElement).value;
                        if (pseudo && pass) handleLogin(pseudo, pass);
                      }}
                      className="bg-stone-100 text-stone-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-stone-200 transition-colors"
                    >
                      {t.loginButton}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Ad Modal */}
      <AnimatePresence>
        {showCreateAd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-2xl p-8 shadow-2xl relative my-8"
            >
              <button 
                onClick={() => setShowCreateAd(false)}
                className="absolute top-6 right-6 p-2 hover:bg-stone-100 rounded-full"
              >
                <X size={20} />
              </button>
              
              <h3 className="text-3xl font-bold mb-6">{t.createAdTitle}</h3>
              
              <form onSubmit={handleCreateAd} className="space-y-6">
                <div className="flex justify-center">
                  <label className="relative cursor-pointer group w-full">
                    <div className="w-full h-40 rounded-3xl bg-stone-100 border-2 border-dashed border-stone-300 flex items-center justify-center overflow-hidden transition-colors group-hover:border-emerald-400">
                      {adForm.image_data ? (
                        <img src={adForm.image_data} alt="Aperçu" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center">
                          <Plus size={32} className="mx-auto text-stone-400 mb-2" />
                          <span className="text-xs text-stone-500 font-bold uppercase">{t.placeholders.addPhoto}</span>
                        </div>
                      )}
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={e => handleFileChange(e, 'ad')}
                      disabled={!isOnline}
                    />
                    {!isOnline && (
                      <div className="absolute inset-0 bg-stone-50/80 flex items-center justify-center rounded-3xl">
                        <Globe size={24} className="text-stone-400" />
                      </div>
                    )}
                  </label>
                </div>

                <div className="flex gap-4 p-1 bg-stone-100 rounded-2xl">
                  <button 
                    type="button"
                    onClick={() => setAdForm({...adForm, type: 'offer'})}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${adForm.type === 'offer' ? 'bg-white shadow-sm text-primary' : 'text-stone-500'}`}
                  >
                    {t.offer.toUpperCase()}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setAdForm({...adForm, type: 'request'})}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${adForm.type === 'request' ? 'bg-white shadow-sm text-primary' : 'text-stone-500'}`}
                  >
                    {t.request.toUpperCase()}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">{t.adCategory}</label>
                    <select 
                      className="input-field capitalize"
                      value={adForm.category}
                      onChange={e => setAdForm({...adForm, category: e.target.value as Category})}
                    >
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{(t.categories as any)[cat] || cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">{t.exchangeCategory}</label>
                    <select 
                      className="input-field capitalize"
                      value={adForm.exchange_category}
                      onChange={e => setAdForm({...adForm, exchange_category: e.target.value})}
                    >
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{(t.categories as any)[cat] || cat}</option>)}
                      <option value="autre">{t.placeholders.other}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">{t.createAd.adTitle}</label>
                  <input 
                    required
                    type="text" 
                    className="input-field" 
                    placeholder={t.placeholders.adTitle}
                    value={adForm.title}
                    onChange={e => setAdForm({...adForm, title: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">{t.createAd.adDescription}</label>
                  <textarea 
                    className="input-field h-24 resize-none" 
                    placeholder={t.placeholders.adDescription}
                    value={adForm.description}
                    onChange={e => setAdForm({...adForm, description: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">{t.createAd.availabilityDetails}</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder={t.placeholders.availability}
                    value={adForm.availability_details}
                    onChange={e => setAdForm({...adForm, availability_details: e.target.value})}
                  />
                </div>

                <div className="space-y-4 p-6 bg-stone-50 rounded-3xl">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold flex items-center gap-2">
                      <Clock size={16} />
                      {t.availability}
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 accent-primary"
                        checked={adForm.is_all_year}
                        onChange={e => setAdForm({...adForm, is_all_year: e.target.checked})}
                      />
                      <span className="text-xs font-medium">{t.allYearRound}</span>
                    </label>
                  </div>
                  
                  {!adForm.is_all_year && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-stone-400 mb-1">{t.startDate}</label>
                        <input 
                          type="date" 
                          className="input-field py-1.5"
                          value={adForm.start_date}
                          onChange={e => setAdForm({...adForm, start_date: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-stone-400 mb-1">{t.endDate}</label>
                        <input 
                          type="date" 
                          className="input-field py-1.5"
                          value={adForm.end_date}
                          onChange={e => setAdForm({...adForm, end_date: e.target.value})}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button type="submit" className="btn-primary w-full py-3 text-lg">
                  {t.publish}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation (Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 sm:hidden px-6 py-3 flex justify-around items-center z-40">
        <button className="flex flex-col items-center gap-1 text-primary">
          <Search size={20} />
          <span className="text-[10px] font-bold uppercase">{t.nav.explorer}</span>
        </button>
        {user && (
          <button 
            onClick={() => setShowCreateAd(true)}
            className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center -mt-8 border-4 border-secondary shadow-lg"
          >
            <Plus size={24} />
          </button>
        )}
        <button 
          onClick={() => !user && setShowRegister(true)}
          className="flex flex-col items-center gap-1 text-stone-400"
        >
          <UserIcon size={20} />
          <span className="text-[10px] font-bold uppercase">{user ? t.nav.profile : t.nav.account}</span>
        </button>
      </div>
    </div>
  );
}
