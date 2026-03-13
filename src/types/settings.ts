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

export interface Settings {
  apiKey: string;
  model: 'claude-opus-4-20250514' | 'claude-sonnet-4-20250514';
  userProfile: UserProfile;
  templates: Record<string, Template>;
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'claude-sonnet-4-20250514',
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
