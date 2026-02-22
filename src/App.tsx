import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, AuthProvider } from './AuthContext';
import { useLanguage, LanguageProvider } from './LanguageContext';
import { CATEGORIES } from './constants';
import { 
  Home, 
  PlusCircle, 
  User, 
  MessageSquare, 
  Image as ImageIcon, 
  Globe, 
  LogOut, 
  Search, 
  Filter, 
  Share2, 
  CheckCircle, 
  XCircle, 
  MessageCircle,
  Menu,
  X,
  ChevronRight,
  Calendar,
  Clock,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { fr, ht } from 'date-fns/locale';
import { resizeImage, generateId } from './utils';
import { initDB, addToSyncQueue } from './services/db';
import './sync';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Navbar = () => {
  const { user, logout, isOffline } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      {isOffline && (
        <div className="bg-orange-500 text-white text-xs py-1 text-center font-medium">
          {t('offline')}
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
              T
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">Twokaj</span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/" className="text-gray-600 hover:text-emerald-600 font-medium transition-colors">{t('allAds')}</Link>
            <Link to="/gallery" className="text-gray-600 hover:text-emerald-600 font-medium transition-colors">{t('gallery')}</Link>
            {user ? (
              <>
                <Link to="/create" className="flex items-center space-x-1 text-emerald-600 hover:text-emerald-700 font-semibold">
                  <PlusCircle size={18} />
                  <span>{t('createAd')}</span>
                </Link>
                <Link to="/messages" className="text-gray-600 hover:text-emerald-600 transition-colors">
                  <MessageSquare size={20} />
                </Link>
                <Link to="/profile" className="text-gray-600 hover:text-emerald-600 transition-colors">
                  <User size={20} />
                </Link>
                <button onClick={logout} className="text-gray-400 hover:text-red-500 transition-colors">
                  <LogOut size={20} />
                </button>
              </>
            ) : (
              <Link to="/login" className="bg-emerald-600 text-white px-4 py-2 rounded-full font-medium hover:bg-emerald-700 transition-all shadow-md active:scale-95">
                {t('login')}
              </Link>
            )}
            <button 
              onClick={() => setLanguage(language === 'fr' ? 'ht' : 'fr')}
              className="flex items-center space-x-1 text-xs font-bold uppercase tracking-wider text-gray-400 border border-gray-200 px-2 py-1 rounded hover:bg-gray-50"
            >
              <Globe size={14} />
              <span>{language === 'fr' ? 'HT' : 'FR'}</span>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center space-x-4">
            <button onClick={() => setLanguage(language === 'fr' ? 'ht' : 'fr')} className="text-gray-400">
              <Globe size={20} />
            </button>
            <button onClick={() => setIsOpen(!isOpen)} className="text-gray-600">
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-gray-100 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-2">
              <Link to="/" onClick={() => setIsOpen(false)} className="block py-3 text-gray-700 font-medium border-b border-gray-50">{t('allAds')}</Link>
              {user ? (
                <>
                  <Link to="/create" onClick={() => setIsOpen(false)} className="block py-3 text-emerald-600 font-semibold border-b border-gray-50">{t('createAd')}</Link>
                  <Link to="/messages" onClick={() => setIsOpen(false)} className="block py-3 text-gray-700 font-medium border-b border-gray-50">{t('letChat')}</Link>
                  <Link to="/profile" onClick={() => setIsOpen(false)} className="block py-3 text-gray-700 font-medium border-b border-gray-50">{t('myAds')}</Link>
                  <button onClick={() => { logout(); setIsOpen(false); }} className="block w-full text-left py-3 text-red-500 font-medium">{t('login')}</button>
                </>
              ) : (
                <Link to="/login" onClick={() => setIsOpen(false)} className="block py-3 text-emerald-600 font-semibold">{t('login')}</Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

// --- Pages ---

const HomeView = () => {
  const { t, language } = useLanguage();
  const [ads, setAds] = useState<any[]>([]);
  const [filter, setFilter] = useState({ category: '', location: '', type: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAds = async () => {
      try {
        const db = await initDB();
        const localAds = await db.getAll('ads');
        setAds(localAds.filter(a => a.status === 'open').sort((a, b) => b.created_at.localeCompare(a.created_at)));
        
        if (navigator.onLine) {
          const res = await fetch('/api/ads');
          const data = await res.json();
          setAds(data);
          // Update local DB
          for (const ad of data) {
            await db.put('ads', ad);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAds();
  }, []);

  const filteredAds = ads.filter(ad => {
    return (
      (!filter.category || ad.category === filter.category) &&
      (!filter.location || ad.location.toLowerCase().includes(filter.location.toLowerCase())) &&
      (!filter.type || ad.type === filter.type)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div className="flex-1 space-y-4">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{t('allAds')}</h1>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder={t('location')}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                value={filter.location}
                onChange={e => setFilter({ ...filter, location: e.target.value })}
              />
            </div>
            <select 
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none appearance-none bg-white"
              value={filter.category}
              onChange={e => setFilter({ ...filter, category: e.target.value })}
            >
              <option value="">{t('category')}</option>
              {CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label[language]}</option>
              ))}
            </select>
            <select 
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none appearance-none bg-white"
              value={filter.type}
              onChange={e => setFilter({ ...filter, type: e.target.value })}
            >
              <option value="">Type</option>
              <option value="proposition">{t('proposition')}</option>
              <option value="demand">{t('demand')}</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAds.map(ad => (
            <AdCard key={ad.id} ad={ad} />
          ))}
          {filteredAds.length === 0 && (
            <div className="col-span-full text-center py-20 text-gray-500 italic">
              Aucune annonce trouvée.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const AdCard = ({ ad }: any) => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const categoryLabel = CATEGORIES.find(c => c.id === ad.category)?.label[language];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      onClick={() => navigate(`/ad/${ad.id}`)}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden group"
    >
      <div className="aspect-[4/3] relative bg-gray-100 overflow-hidden">
        {ad.photo ? (
          <img src={ad.photo} alt={ad.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <ImageIcon size={48} />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className={cn(
            "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm",
            ad.type === 'proposition' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
          )}>
            {ad.type === 'proposition' ? t('proposition') : t('demand')}
          </span>
        </div>
      </div>
      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 uppercase tracking-widest">
          <span>{categoryLabel}</span>
          <span className="text-gray-400 font-normal">{format(new Date(ad.created_at), 'dd MMM yyyy', { locale: language === 'fr' ? fr : ht })}</span>
        </div>
        <h3 className="text-lg font-bold text-gray-900 line-clamp-1">{ad.title}</h3>
        <div className="flex items-center text-gray-500 text-sm">
          <MapPin size={14} className="mr-1" />
          <span>{ad.location}</span>
        </div>
        <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold">
              {ad.pseudo?.[0]?.toUpperCase()}
            </div>
            <span className="text-xs text-gray-600 font-medium">{ad.pseudo}</span>
          </div>
          <ChevronRight size={16} className="text-gray-300" />
        </div>
      </div>
    </motion.div>
  );
};

const AdDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [ad, setAd] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAd = async () => {
      const db = await initDB();
      const localAd = await db.get('ads', id!);
      setAd(localAd);
      
      if (user) {
        const res = await fetch(`/api/messages/${user.id}`);
        const data = await res.json();
        setMessages(data.filter((m: any) => m.ad_id === id));
      }
    };
    fetchAd();
  }, [id, user]);

  if (!ad) return null;

  const handleContact = async () => {
    if (!user) return navigate('/login');
    const msg = {
      id: generateId(),
      ad_id: ad.id,
      sender_id: user.id,
      receiver_id: ad.user_id,
      content: "Mwen enterese nan anons ou a.",
      type: 'contact'
    };
    
    if (navigator.onLine) {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg)
      });
    } else {
      await addToSyncQueue({ type: 'message', action: 'create', data: msg });
    }
    setMessages([...messages, { ...msg, sender_pseudo: user.pseudo }]);
  };

  const handleChat = async () => {
    if (!newMessage.trim()) return;
    const msg = {
      id: generateId(),
      ad_id: ad.id,
      sender_id: user.id,
      receiver_id: user.id === ad.user_id ? messages[0].sender_id : ad.user_id,
      content: newMessage,
      type: 'chat'
    };
    
    if (navigator.onLine) {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg)
      });
    } else {
      await addToSyncQueue({ type: 'message', action: 'create', data: msg });
    }
    setMessages([...messages, { ...msg, sender_pseudo: user.pseudo }]);
    setNewMessage('');
  };

  const handleAction = async (type: 'deal' | 'refuse') => {
    const msg = {
      id: generateId(),
      ad_id: ad.id,
      sender_id: user.id,
      receiver_id: messages[0].sender_id,
      content: type === 'deal' ? "Sa mache !" : "Mwen pa enterese",
      type
    };
    
    if (navigator.onLine) {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg)
      });
    } else {
      await addToSyncQueue({ type: 'message', action: 'create', data: msg });
    }
    setMessages([...messages, { ...msg, sender_pseudo: user.pseudo }]);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
        <div className="aspect-video relative bg-gray-100">
          {ad.photo ? (
            <img src={ad.photo} alt={ad.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <ImageIcon size={64} />
            </div>
          )}
          <div className="absolute bottom-6 left-6 flex gap-2">
            <span className={cn(
              "px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider shadow-lg backdrop-blur-md",
              ad.type === 'proposition' ? "bg-emerald-500/80 text-white" : "bg-blue-500/80 text-white"
            )}>
              {ad.type === 'proposition' ? t('proposition') : t('demand')}
            </span>
          </div>
        </div>

        <div className="p-8 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-gray-900">{ad.title}</h1>
              <button 
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: ad.title,
                      text: ad.description,
                      url: window.location.href
                    });
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                    alert("Lien copié !");
                  }
                }}
                className="p-2 hover:bg-gray-50 rounded-full text-gray-400 transition-colors"
              >
                <Share2 size={24} />
              </button>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-gray-500">
              <div className="flex items-center">
                <MapPin size={18} className="mr-2 text-emerald-600" />
                <span>{ad.location}</span>
              </div>
              <div className="flex items-center">
                <Calendar size={18} className="mr-2 text-emerald-600" />
                <span>{ad.start_date} - {ad.end_date}</span>
              </div>
              <div className="flex items-center">
                <User size={18} className="mr-2 text-emerald-600" />
                <span>{ad.pseudo}</span>
              </div>
            </div>
          </div>

          <div className="prose prose-emerald max-w-none">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
            <p className="text-gray-600 leading-relaxed">{ad.description}</p>
          </div>

          {ad.availability && (
            <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-gray-900 flex items-center">
                <Clock size={20} className="mr-2 text-emerald-600" />
                {t('availability')}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Object.entries(ad.availability).map(([day, times]: any) => (
                  <div key={day} className="text-sm">
                    <span className="font-semibold block text-gray-700">{day}</span>
                    <span className="text-gray-500">{times.start} - {times.end}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {user && user.id !== ad.user_id && messages.length === 0 && (
            <button 
              onClick={handleContact}
              className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-emerald-700 transition-all active:scale-[0.98]"
            >
              {t('contactMe')}
            </button>
          )}

          {messages.length > 0 && (
            <div className="space-y-6 pt-8 border-t border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">{t('letChat')}</h3>
              <div className="space-y-4 max-h-96 overflow-y-auto p-4 bg-gray-50 rounded-2xl">
                {messages.map(m => (
                  <div key={m.id} className={cn(
                    "flex flex-col max-w-[80%]",
                    m.sender_id === user?.id ? "ml-auto items-end" : "items-start"
                  )}>
                    <span className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-tighter">{m.sender_pseudo}</span>
                    <div className={cn(
                      "px-4 py-2 rounded-2xl text-sm shadow-sm",
                      m.sender_id === user?.id ? "bg-emerald-600 text-white rounded-tr-none" : "bg-white text-gray-700 rounded-tl-none"
                    )}>
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Ekri yon mesaj..."
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <button 
                  onClick={handleChat}
                  className="bg-emerald-600 text-white px-6 rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                >
                  <MessageCircle size={20} />
                </button>
              </div>

              {user?.id === ad.user_id && (
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <button 
                    onClick={() => handleAction('deal')}
                    className="flex items-center justify-center space-x-2 bg-emerald-100 text-emerald-700 py-3 rounded-xl font-bold hover:bg-emerald-200 transition-colors"
                  >
                    <CheckCircle size={20} />
                    <span>{t('itWorks')}</span>
                  </button>
                  <button 
                    onClick={() => handleAction('refuse')}
                    className="flex items-center justify-center space-x-2 bg-red-100 text-red-700 py-3 rounded-xl font-bold hover:bg-red-200 transition-colors"
                  >
                    <XCircle size={20} />
                    <span>{t('notInterested')}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CreateAd = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    type: 'proposition',
    category: 'labor',
    title: '',
    description: '',
    location: '',
    start_date: '',
    end_date: '',
    photo: '',
    availability: {
      'Lun': { start: '08:00', end: '17:00' },
      'Mar': { start: '08:00', end: '17:00' },
      'Mer': { start: '08:00', end: '17:00' },
      'Jeu': { start: '08:00', end: '17:00' },
      'Ven': { start: '08:00', end: '17:00' },
    } as any,
  });

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) return alert("Image trop lourde (max 5Mo)");
      const resized = await resizeImage(file);
      setForm({ ...form, photo: resized });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const ad = {
      ...form,
      id: generateId(),
      user_id: user.id,
      pseudo: user.pseudo,
      created_at: new Date().toISOString(),
      status: 'open',
      availability: {} // Simplified for now
    };

    if (navigator.onLine) {
      await fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ad)
      });
    } else {
      await addToSyncQueue({ type: 'ad', action: 'create', data: ad });
      const db = await initDB();
      await db.add('ads', ad);
    }
    navigate('/');
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-8 space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">{t('createAd')}</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <button 
              type="button"
              onClick={() => setForm({ ...form, type: 'proposition' })}
              className={cn(
                "py-3 rounded-xl font-bold border-2 transition-all",
                form.type === 'proposition' ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-gray-100 text-gray-400"
              )}
            >
              {t('proposition')}
            </button>
            <button 
              type="button"
              onClick={() => setForm({ ...form, type: 'demand' })}
              className={cn(
                "py-3 rounded-xl font-bold border-2 transition-all",
                form.type === 'demand' ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-100 text-gray-400"
              )}
            >
              {t('demand')}
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">{t('category')}</label>
            <select 
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label[language]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Tit</label>
            <input 
              type="text" 
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Deskripsyon</label>
            <textarea 
              required
              rows={4}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">{t('location')}</label>
            <input 
              type="text" 
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Dat kòmansman</label>
              <input 
                type="date" 
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                value={form.start_date}
                onChange={e => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Dat fen</label>
              <input 
                type="date" 
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                value={form.end_date}
                onChange={e => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">{t('adPhoto')}</label>
            <div className="relative group">
              <input 
                type="file" 
                accept="image/*"
                onChange={handlePhoto}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
              />
              <div className="w-full aspect-video border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-400 group-hover:border-emerald-500 group-hover:text-emerald-500 transition-all overflow-hidden">
                {form.photo ? (
                  <img src={form.photo} className="w-full h-full object-cover" />
                ) : (
                  <>
                    <ImageIcon size={48} className="mb-2" />
                    <span className="text-sm font-medium">Klike pou chwazi yon foto</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-bold text-gray-700">{t('availability')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.keys(form.availability).map(day => (
                <div key={day} className="flex items-center space-x-2 bg-gray-50 p-2 rounded-xl">
                  <span className="w-10 font-bold text-xs">{day}</span>
                  <input 
                    type="time" 
                    className="bg-transparent text-xs outline-none"
                    value={form.availability[day].start}
                    onChange={e => setForm({
                      ...form,
                      availability: {
                        ...form.availability,
                        [day]: { ...form.availability[day], start: e.target.value }
                      }
                    })}
                  />
                  <span className="text-gray-400">-</span>
                  <input 
                    type="time" 
                    className="bg-transparent text-xs outline-none"
                    value={form.availability[day].end}
                    onChange={e => setForm({
                      ...form,
                      availability: {
                        ...form.availability,
                        [day]: { ...form.availability[day], end: e.target.value }
                      }
                    })}
                  />
                </div>
              ))}
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "Ap anrejistre..." : t('save')}
          </button>
        </form>
      </div>
    </div>
  );
};

const Login = () => {
  const { t } = useLanguage();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    pseudo: '',
    address: '',
    phone: '',
    profile_photo: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister) {
      const newUser = { ...form, id: generateId(), categories: [] };
      if (navigator.onLine) {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newUser)
        });
        if (res.ok) login(newUser);
      } else {
        await addToSyncQueue({ type: 'user', action: 'create', data: newUser });
        login(newUser);
      }
    } else {
      if (navigator.onLine) {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email, password: form.password })
        });
        if (res.ok) login(await res.json());
      } else {
        alert("Koneksyon entènèt nesesè pou premye koneksyon an.");
      }
    }
    navigate('/');
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">{isRegister ? t('register') : t('login')}</h2>
          <p className="mt-2 text-gray-500">Byenveni sou Twokaj</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <input 
                type="text" 
                placeholder={t('name')}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
              <input 
                type="text" 
                placeholder={t('pseudo')}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                value={form.pseudo}
                onChange={e => setForm({ ...form, pseudo: e.target.value })}
              />
              <input 
                type="text" 
                placeholder={t('address')}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
              />
            </>
          )}
          <input 
            type="email" 
            placeholder={t('email')}
            required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
          />
          <input 
            type="password" 
            placeholder={t('password')}
            required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
          />
          
          <button 
            type="submit"
            className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-emerald-700 transition-all active:scale-[0.98]"
          >
            {isRegister ? t('register') : t('login')}
          </button>
        </form>

        <div className="text-center">
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="text-emerald-600 font-medium hover:underline"
          >
            {isRegister ? "Ou gen yon kont deja ? Konekte" : "Ou pa gen kont ? Enskri"}
          </button>
        </div>
      </div>
    </div>
  );
};

const Profile = () => {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [ads, setAds] = useState<any[]>([]);

  useEffect(() => {
    const fetchMyAds = async () => {
      const db = await initDB();
      const localAds = await db.getAll('ads');
      setAds(localAds.filter(a => a.user_id === user?.id));
    };
    fetchMyAds();
  }, [user]);

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-8 flex flex-col md:flex-row items-center gap-8">
        <div className="w-32 h-32 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-4xl font-bold border-4 border-white shadow-lg overflow-hidden">
          {user.profile_photo ? <img src={user.profile_photo} className="w-full h-full object-cover" /> : user.pseudo[0].toUpperCase()}
        </div>
        <div className="flex-1 text-center md:text-left space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">{user.name}</h1>
          <p className="text-gray-500 font-medium">@{user.pseudo}</p>
          <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm text-gray-400">
            <span className="flex items-center"><MapPin size={14} className="mr-1" /> {user.address}</span>
            {user.phone && <span className="flex items-center"><Clock size={14} className="mr-1" /> {user.phone}</span>}
          </div>
        </div>
        <button onClick={logout} className="px-6 py-2 border border-red-100 text-red-500 rounded-full font-bold hover:bg-red-50 transition-colors">
          {t('login')}
        </button>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('myAds')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {ads.map(ad => (
            <div key={ad.id} className="relative">
              <AdCard ad={ad} />
              {ad.status === 'open' && (
                <button 
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (navigator.onLine) {
                      await fetch(`/api/ads/${ad.id}/close`, { method: 'PATCH' });
                    }
                    const db = await initDB();
                    await db.put('ads', { ...ad, status: 'closed' });
                    setAds(ads.map(a => a.id === ad.id ? { ...a, status: 'closed' } : a));
                  }}
                  className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg hover:bg-red-600 transition-colors"
                >
                  {t('closeAd')}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const GalleryView = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newPhoto, setNewPhoto] = useState({ photo_url: '', description: '' });

  useEffect(() => {
    const fetchGallery = async () => {
      try {
        const res = await fetch('/api/gallery');
        const data = await res.json();
        setItems(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchGallery();
  }, []);

  const handleAdd = async () => {
    const item = { ...newPhoto, id: generateId() };
    await fetch('/api/gallery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    setItems([item, ...items]);
    setShowAdd(false);
    setNewPhoto({ photo_url: '', description: '' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">{t('gallery')}</h1>
        {user?.is_admin && (
          <button 
            onClick={() => setShowAdd(true)}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold flex items-center space-x-2"
          >
            <PlusCircle size={20} />
            <span>Ajoute foto</span>
          </button>
        )}
      </div>

      {showAdd && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-lg space-y-4">
          <input 
            type="file" 
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) setNewPhoto({ ...newPhoto, photo_url: await resizeImage(file) });
            }}
            className="w-full"
          />
          <input 
            type="text" 
            placeholder="Deskripsyon"
            className="w-full px-4 py-2 border border-gray-200 rounded-xl"
            value={newPhoto.description}
            onChange={e => setNewPhoto({ ...newPhoto, description: e.target.value })}
          />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold">Anrejistre</button>
            <button onClick={() => setShowAdd(false)} className="bg-gray-100 text-gray-600 px-4 py-2 rounded-xl font-bold">Anile</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map(item => (
          <div key={item.id} className="aspect-square rounded-2xl overflow-hidden bg-gray-100 group relative">
            <img src={item.photo_url} alt={item.description} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
            {item.description && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                <p className="text-white text-xs font-medium">{item.description}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <Router>
          <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<HomeView />} />
                <Route path="/ad/:id" element={<AdDetail />} />
                <Route path="/create" element={<CreateAd />} />
                <Route path="/login" element={<Login />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/gallery" element={<GalleryView />} />
                <Route path="/messages" element={<div className="p-8 text-center text-gray-400 italic">Mesaj yo ap vini byento...</div>} />
              </Routes>
            </main>
            <footer className="bg-white border-t border-gray-100 py-8">
              <div className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-sm">
                &copy; 2026 Twokaj - Echanj agrikòl an Ayiti
              </div>
            </footer>
          </div>
        </Router>
      </LanguageProvider>
    </AuthProvider>
  );
}

// Helper for useParams
import { useParams } from 'react-router-dom';
