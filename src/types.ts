export type Category = 'échange de main d\'oeuvre' | 'prêt de terrains' | 'animaux' | 'plantes' | 'dons' | 'outils';

export interface User {
  id: number;
  name: string;
  pseudo: string;
  address: string;
  city: string;
  phone?: string;
  image_data?: string;
}

export interface Ad {
  id: number;
  user_id: number;
  pseudo: string;
  user_city: string;
  type: 'offer' | 'request';
  category: Category;
  title: string;
  description: string;
  exchange_category: Category | string;
  start_date: string | null;
  end_date: string | null;
  is_all_year: boolean;
  image_data?: string;
  user_image?: string;
  status: 'open' | 'closed';
  created_at: string;
}

export interface Message {
  id: number;
  ad_id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  type: 'normal' | 'deal_accepted' | 'deal_rejected';
  created_at: string;
  sender_pseudo?: string;
  receiver_pseudo?: string;
  ad_title?: string;
}

export interface GalleryImage {
  id: number;
  image_data: string;
  caption?: string;
  created_at: string;
}

export const CATEGORIES: Category[] = [
  'échange de main d\'oeuvre',
  'prêt de terrains',
  'animaux',
  'plantes',
  'dons',
  'outils'
];

export const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export const DAYS = [
  'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'
];
