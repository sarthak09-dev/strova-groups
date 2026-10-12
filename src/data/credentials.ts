export interface CredentialItem {
  id: string;
  label: string;
  badgeText: string;
  verifiableUrl?: string; // If absent or empty, the component MUST NOT render this item!
  description?: string;
}

/**
 * Strova Group verifiable credentials.
 * Absolute Rule: Items without a verifiable URL are strictly omitted from rendering.
 */
export const credentialsConfig: CredentialItem[] = [
  {
    id: 'udyam',
    label: 'Ministry of MSME, Govt. of India',
    badgeText: 'UDYAM-JH-20-0147452',
    verifiableUrl: 'https://udyamregistration.gov.in/Udyam_Verify.aspx',
    description: 'Registered Micro Enterprise under Govt. of India',
  },
  {
    id: 'google-business',
    label: 'Google Business Profile',
    badgeText: 'Google Business Listing',
    verifiableUrl: '', // Omitted until live verified profile URL is supplied
  },
  {
    id: 'clutch',
    label: 'Clutch Directory',
    badgeText: 'Clutch Verified',
    verifiableUrl: '', // Omitted until live profile URL is supplied
  },
  {
    id: 'github',
    label: 'GitHub Organization',
    badgeText: 'Open Source Repositories',
    verifiableUrl: '', // Omitted until live organization URL is supplied
  },
];
