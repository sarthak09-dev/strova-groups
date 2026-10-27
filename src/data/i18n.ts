/**
 * Strova Group — Internationalization (i18n) Dictionary & Routing Helper
 * 
 * Provides verified translations and path-mapping utilities for:
 * - English (en) — Global Default
 * - Hindi (hi) — Domestic / India
 */

export type Locale = 'en' | 'hi';

export interface NavLink {
  href: string;
  label: string;
}

export interface I18nContent {
  brand: string;
  tagline: string;
  topbar: {
    country: string;
    msme: string;
    hours: string;
    hoursDetailed: string;
  };
  nav: {
    home: string;
    technologies: string;
    digital: string;
    commerce: string;
    about: string;
    caseStudies: string;
    contact: string;
    faq: string;
  };
  actions: {
    discussProject: string;
    exploreCapabilities: string;
    requestQuote: string;
    whatsappChat: string;
    emailUs: string;
    viewProjects: string;
    switchLang: string;
  };
  mobileQuote: {
    text: string;
    button: string;
  };
  footer: {
    proprietorNotice: string;
    msmeRegistry: string;
    rights: string;
    divisionsTitle: string;
    companyTitle: string;
    legalTitle: string;
    internationalNotice: string;
  };
}

export const translations: Record<Locale, I18nContent> = {
  en: {
    brand: 'Strova Group',
    tagline: 'IDEAS / TECHNOLOGY / GROWTH',
    topbar: {
      country: 'India',
      msme: 'MSME: UDYAM-JH-20-0147452',
      hours: '10:00 AM – 7:00 PM IST',
      hoursDetailed: 'Mon–Sat, 10:00 AM – 7:00 PM IST (UTC+5:30)',
    },
    nav: {
      home: 'Home',
      technologies: 'Technologies',
      digital: 'Digital',
      commerce: 'Commerce',
      about: 'About',
      caseStudies: 'Case Studies',
      contact: 'Contact',
      faq: 'FAQ',
    },
    actions: {
      discussProject: 'Discuss a project',
      exploreCapabilities: 'Explore our capabilities',
      requestQuote: 'Request a quote',
      whatsappChat: 'WhatsApp',
      emailUs: 'info@strovagroups.in',
      viewProjects: 'View projects',
      switchLang: 'Switch language to Hindi',
    },
    mobileQuote: {
      text: 'Planning a project?',
      button: 'Request a quote',
    },
    footer: {
      proprietorNotice: 'Strova Group is a proprietorship of Babita Kumari. Registered Micro Enterprise under the Ministry of MSME, Govt. of India.',
      msmeRegistry: 'UDYAM-JH-20-0147452',
      rights: 'All rights reserved.',
      divisionsTitle: 'Divisions & Services',
      companyTitle: 'Company & Practice',
      legalTitle: 'Compliance & Legal',
      internationalNotice: 'Serving commercial enterprises in India and international clients globally with remote collaboration and transparent milestones.',
    },
  },
  hi: {
    brand: 'स्ट्रोवा ग्रुप',
    tagline: 'विचार / प्रौद्योगिकी / प्रगति &bull; IDEAS / TECHNOLOGY / GROWTH',
    topbar: {
      country: 'भारत',
      msme: 'एमएसएमई: UDYAM-JH-20-0147452',
      hours: '10:00 AM – 7:00 PM IST',
      hoursDetailed: 'सोम–शनि, 10:00 AM – 7:00 PM IST (UTC+5:30)',
    },
    nav: {
      home: 'मुख्य पृष्ठ',
      technologies: 'प्रौद्योगिकियां',
      digital: 'डिजिटल विकास',
      commerce: 'कॉमर्स',
      about: 'हमारे बारे में',
      caseStudies: 'केस स्टडीज',
      contact: 'संपर्क करें',
      faq: 'सामान्य प्रश्न',
    },
    actions: {
      discussProject: 'प्रोजेक्ट पर चर्चा करें',
      exploreCapabilities: 'हमारी सेवाएं देखें',
      requestQuote: 'कोटेशन प्राप्त करें',
      whatsappChat: 'व्हाट्सएप',
      emailUs: 'info@strovagroups.in',
      viewProjects: 'प्रोजेक्ट्स देखें',
      switchLang: 'Switch to English',
    },
    mobileQuote: {
      text: 'प्रोजेक्ट की योजना बना रहे हैं?',
      button: 'कोटेशन प्राप्त करें',
    },
    footer: {
      proprietorNotice: 'स्ट्रोवा ग्रुप (Strova Group) बबिता कुमारी का एकल स्वामित्व प्रतिष्ठान है। भारत सरकार के सूक्ष्म, लघु एवं मध्यम उद्यम मंत्रालय (MSME) के अंतर्गत पंजीकृत।',
      msmeRegistry: 'UDYAM-JH-20-0147452',
      rights: 'सर्वाधिकार सुरक्षित।',
      divisionsTitle: 'विभाग एवं सेवाएं',
      companyTitle: 'कंपनी एवं कार्यप्रणाली',
      legalTitle: 'अनुपालन एवं कानूनी',
      internationalNotice: 'भारत और वैश्विक ग्राहकों के लिए पारदर्शी माइलस्टोन, सुरक्षित रिमोट समन्वय और निश्चित मूल्य पर आधारित इंजीनियरिंग।',
    },
  },
};

/**
 * Maps any pathname to its equivalent route in the target locale.
 * Preserves subpaths while handling trailing slashes cleanly.
 */
export function getLocalizedPath(currentPath: string, targetLocale: Locale): string {
  // Normalize: remove query, ensure leading slash, remove trailing slash for processing
  const cleanPath = currentPath.split('?')[0].split('#')[0] || '/';
  const isHindi = cleanPath.startsWith('/hi/') || cleanPath === '/hi';

  // Base path without locale prefix
  let unlocalized = cleanPath;
  if (isHindi) {
    unlocalized = cleanPath.replace(/^\/hi(\/|$)/, '/');
  }
  if (!unlocalized.startsWith('/')) unlocalized = '/' + unlocalized;
  if (!unlocalized.endsWith('/')) unlocalized = unlocalized + '/';

  if (unlocalized === '/404/' || unlocalized === '/404') {
    return targetLocale === 'hi' ? '/hi/' : '/';
  }

  if (targetLocale === 'en') {
    return unlocalized;
  }

  // targetLocale === 'hi'
  if (unlocalized === '/') {
    return '/hi/';
  }
  return `/hi${unlocalized}`;
}

/**
 * Returns canonical and alternate hreflang URLs for a given route.
 */
export function getHreflangUrls(currentPath: string, siteUrl = 'https://strovagroups.in') {
  const enPath = getLocalizedPath(currentPath, 'en');
  const hiPath = getLocalizedPath(currentPath, 'hi');

  return {
    enUrl: `${siteUrl}${enPath}`,
    hiUrl: `${siteUrl}${hiPath}`,
    xDefaultUrl: `${siteUrl}${enPath}`,
  };
}
