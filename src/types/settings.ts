export interface UserProfile {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  company: string;
  title: string;
}

// A template is a named collection of text fields
export type Template = Record<string, string>;

export type Characteristic = 'casual' | 'detailed' | 'formal';

export const DEFAULT_MODEL = 'claude-sonnet-4-6';
export const COMPUTER_USE_MODEL = 'claude-sonnet-4-6';
export const ROUTER_MODEL = 'claude-haiku-4-5-20251001';

export interface Settings {
  apiKey: string;
  model: string;
  characteristic: Characteristic;
  userProfile: UserProfile;
  templates: Record<string, Template>;
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: DEFAULT_MODEL,
  characteristic: 'casual',
  userProfile: {
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    company: '',
    title: '',
  },
  templates: {
    'Job Application': {
      'LinkedIn URL': '',
      'Portfolio/Website': '',
      'Years of Experience': '',
      'Desired Salary': '',
      'Work Authorization': '',
      'Cover Letter': '',
    },
  },
};
