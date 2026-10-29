export interface ShowcaseConcept {
  image: string;
  pillar: { en: string; hi: string };
  title: { en: string; hi: string };
  description: { en: string; hi: string };
  alt: { en: string; hi: string };
  href: string;
  link: { en: string; hi: string };
}

/** Illustrative interface directions; these are not client projects or case studies. */
export const showcaseConcepts: ShowcaseConcept[] = [
  {
    image: '/images/showcase/digital-website.svg',
    pillar: { en: 'Digital / Website', hi: 'डिजिटल / वेबसाइट' },
    title: { en: 'A clearer experience for your business', hi: 'व्यवसाय के लिए एक स्पष्ट डिजिटल अनुभव' },
    description: { en: 'A considered website concept with room for a strong story, useful detail, and a clear next step.', hi: 'एक सुविचारित वेबसाइट अवधारणा—स्पष्ट कहानी, उपयोगी जानकारी और अगले कदम के साथ।' },
    alt: { en: 'Illustrative desktop website interface concept in Strova brand colors', hi: 'स्ट्रोवा ब्रांड रंगों में डेस्कटॉप वेबसाइट इंटरफ़ेस की उदाहरणात्मक अवधारणा' },
    href: '/technologies/#pillar-digital',
    link: { en: 'Explore Digital', hi: 'डिजिटल सेवाएं देखें' },
  },
  {
    image: '/images/showcase/client-portal.svg',
    pillar: { en: 'Digital / Client portal', hi: 'डिजिटल / ग्राहक पोर्टल' },
    title: { en: 'A more useful client workspace', hi: 'एक अधिक उपयोगी ग्राहक कार्यक्षेत्र' },
    description: { en: 'A portal direction for project updates, milestones, shared files, and clear communication.', hi: 'प्रोजेक्ट अपडेट, माइलस्टोन, साझा फ़ाइलों और स्पष्ट संवाद के लिए पोर्टल अवधारणा।' },
    alt: { en: 'Illustrative customer portal dashboard with project milestones and shared files', hi: 'प्रोजेक्ट माइलस्टोन और साझा फ़ाइलों वाला उदाहरणात्मक ग्राहक पोर्टल डैशबोर्ड' },
    href: '/technologies/#pillar-digital',
    link: { en: 'Explore Digital', hi: 'डिजिटल सेवाएं देखें' },
  },
  {
    image: '/images/showcase/commerce-storefront.svg',
    pillar: { en: 'Digital / Commerce', hi: 'डिजिटल / ई-कॉमर्स' },
    title: { en: 'A storefront that keeps the path simple', hi: 'खरीदारी के रास्ते को सरल रखने वाला स्टोर' },
    description: { en: 'A storefront concept that gives products room to speak and makes navigation feel natural.', hi: 'उत्पादों को जगह देने और सहज नेविगेशन वाली स्टोरफ्रंट अवधारणा।' },
    alt: { en: 'Illustrative e-commerce storefront concept with a considered product grid', hi: 'सुविचारित उत्पाद ग्रिड वाली उदाहरणात्मक ई-कॉमर्स स्टोरफ्रंट अवधारणा' },
    href: '/commerce/',
    link: { en: 'Explore commerce', hi: 'ई-कॉमर्स देखें' },
  },
  {
    image: '/images/showcase/workflow-automation.svg',
    pillar: { en: 'Automation / Workflow', hi: 'ऑटोमेशन / वर्कफ़्लो' },
    title: { en: 'A workflow people can follow', hi: 'ऐसा वर्कफ़्लो जिसे टीम आसानी से समझे' },
    description: { en: 'A practical automation map from enquiry to follow-up, with clear ownership and human review.', hi: 'पूछताछ से फ़ॉलो-अप तक व्यावहारिक ऑटोमेशन—स्पष्ट ज़िम्मेदारी और मानवीय समीक्षा के साथ।' },
    alt: { en: 'Illustrative business automation workflow linking intake, CRM, team routing and review', hi: 'इनटेक, CRM, टीम रूटिंग और समीक्षा को जोड़ता उदाहरणात्मक व्यवसाय ऑटोमेशन वर्कफ़्लो' },
    href: '/technologies/#pillar-automation',
    link: { en: 'Explore Automation', hi: 'ऑटोमेशन देखें' },
  },
  {
    image: '/images/showcase/saas-workspace.svg',
    pillar: { en: 'Products / SaaS', hi: 'उत्पाद / SaaS' },
    title: { en: 'A focused workspace for a real need', hi: 'वास्तविक ज़रूरत के लिए केंद्रित कार्यक्षेत्र' },
    description: { en: 'An example product interface shaped around clear tasks, useful context, and calm hierarchy.', hi: 'स्पष्ट कार्यों, उपयोगी संदर्भ और सहज प्राथमिकता पर आधारित उत्पाद इंटरफ़ेस का उदाहरण।' },
    alt: { en: 'Illustrative SaaS workspace dashboard concept with overview, work items and milestone', hi: 'ओवरव्यू, काम और माइलस्टोन वाला उदाहरणात्मक SaaS कार्यक्षेत्र डैशबोर्ड' },
    href: '/technologies/#pillar-products',
    link: { en: 'Explore Products', hi: 'उत्पाद क्षमता देखें' },
  },
  {
    image: '/images/showcase/mobile-experience.svg',
    pillar: { en: 'Digital / Mobile', hi: 'डिजिटल / मोबाइल' },
    title: { en: 'A mobile experience made to feel clear', hi: 'स्पष्टता के लिए बनाया गया मोबाइल अनुभव' },
    description: { en: 'A mobile-first interface direction with accessible controls and a focused next action.', hi: 'सुलभ नियंत्रण और स्पष्ट अगले कदम वाली मोबाइल-प्रथम इंटरफ़ेस अवधारणा।' },
    alt: { en: 'Illustrative mobile customer interface concept with organized next steps', hi: 'सुव्यवस्थित अगले कदमों वाला उदाहरणात्मक मोबाइल ग्राहक इंटरफ़ेस' },
    href: '/technologies/#pillar-digital',
    link: { en: 'Explore Digital', hi: 'डिजिटल सेवाएं देखें' },
  },
];
