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

export const DEFAULT_MODEL = 'claude-sonnet-4-5-20250514';

export interface Settings {
  apiKey: string;
  characteristic: Characteristic;
  userProfile: UserProfile;
  templates: Record<string, Template>;
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
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
