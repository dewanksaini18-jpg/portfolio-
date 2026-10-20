// What each editable list and settings group looks like in the dashboard.
// To add a field to the website, add it here and read it in lib/render.js.
import { SOCIAL_PLATFORMS } from '/shared/defaults.js';

export const CATEGORY_SUGGESTIONS = ['Reels', 'YouTube', 'Short-form', 'Motion graphics', 'Showreel', 'Ads', 'Wedding', 'Real estate', 'Corporate'];

export const COLLECTIONS = {
  services: {
    label: 'Services',
    one: 'service',
    help: 'What you offer. These also appear in the booking form.',
    title: (d) => d.title,
    sub: (d) => d.description,
    fields: [
      { k: 'title', label: 'Service name', type: 'text', required: true },
      { k: 'description', label: 'Short description', type: 'textarea', rows: 3 },
      { k: 'deliverables', label: 'What you deliver', type: 'lines', hint: 'One item per line. Shown as small tags.' },
    ],
  },
  testimonials: {
    label: 'Testimonials',
    one: 'testimonial',
    help: 'Only add real words from real clients.',
    title: (d) => d.name,
    sub: (d) => d.quote,
    fields: [
      { k: 'quote', label: 'What they said', type: 'textarea', rows: 4, required: true },
      { k: 'name', label: 'Name', type: 'text', required: true },
      { k: 'role', label: 'Role and company', type: 'text' },
      { k: 'avatar', label: 'Photo (optional)', type: 'image', folder: 'people' },
    ],
  },
  faq: {
    label: 'FAQ',
    one: 'question',
    help: 'Questions clients ask before they book.',
    title: (d) => d.question,
    sub: (d) => d.answer,
    fields: [
      { k: 'question', label: 'Question', type: 'text', required: true },
      { k: 'answer', label: 'Answer', type: 'textarea', rows: 4, required: true },
    ],
  },
  process: {
    label: 'Process steps',
    one: 'step',
    help: 'How a project runs, in order. The website numbers the steps for you.',
    title: (d) => d.title,
    sub: (d) => d.description,
    fields: [
      { k: 'title', label: 'Step name', type: 'text', required: true },
      { k: 'description', label: 'What happens', type: 'textarea', rows: 3 },
    ],
  },
  tools: {
    label: 'Tools',
    one: 'tool',
    help: 'Software you edit with.',
    title: (d) => d.name,
    sub: () => '',
    fields: [{ k: 'name', label: 'Tool name', type: 'text', required: true }],
  },
  clients: {
    label: 'Client logos',
    one: 'client',
    help: 'Brands you have worked with. Only add clients who are happy to be named.',
    title: (d) => d.name,
    sub: (d) => d.url,
    fields: [
      { k: 'name', label: 'Client name', type: 'text', required: true },
      { k: 'logo', label: 'Logo (optional)', type: 'image', folder: 'logos', hint: 'Without a logo the name is shown as text.' },
      { k: 'url', label: 'Website (optional)', type: 'url' },
    ],
  },
  stats: {
    label: 'Numbers',
    one: 'number',
    help: 'Short facts shown next to your client logos. Use real numbers only.',
    title: (d) => `${d.value} ${d.label}`,
    sub: () => '',
    fields: [
      { k: 'value', label: 'Number', type: 'text', required: true, hint: 'For example 120+ or 4 years.' },
      { k: 'label', label: 'Label', type: 'text', required: true },
    ],
  },
  socials: {
    label: 'Social links',
    one: 'link',
    help: 'Links with an empty address stay hidden on the website.',
    title: (d) => d.platform,
    sub: (d) => d.url,
    fields: [
      { k: 'platform', label: 'Platform', type: 'select', options: SOCIAL_PLATFORMS },
      { k: 'label', label: 'Name shown on the website (optional)', type: 'text', placeholder: '@Wolf_edit', hint: 'For example your handle. Leave empty to show the web address.' },
      { k: 'url', label: 'Link', type: 'url', placeholder: 'https://' },
    ],
  },
};

export const SETTINGS_GROUPS = {
  brand: {
    label: 'Brand and hero',
    sections: [
      {
        key: 'brand',
        title: 'Brand',
        fields: [
          { k: 'name', label: 'Brand name', type: 'text', required: true, hint: 'Used in the page title, footer and when no logo is set.' },
          { k: 'logo', label: 'Logo', type: 'image', folder: 'brand', hint: 'A PNG or WebP with a transparent background works best. It shows in the menu and at the top of the homepage.' },
          { k: 'owner', label: 'Your name (optional)', type: 'text', hint: 'Shown in the About section and used for Google.' },
          { k: 'role', label: 'What you do', type: 'text' },
          { k: 'tagline', label: 'Tagline', type: 'text' },
          { k: 'availability_on', label: 'Show an availability badge', type: 'check' },
          { k: 'availability_text', label: 'Badge text', type: 'text', placeholder: 'Open for new projects' },
        ],
      },
      {
        key: 'hero',
        title: 'Hero and showreel',
        fields: [
          { k: 'intro', label: 'Intro line', type: 'textarea', rows: 3 },
          { k: 'showreel_url', label: 'Showreel link', type: 'url', hint: 'YouTube, Vimeo, Google Drive or a video file link. Leave empty to show the "coming soon" screen.' },
          { k: 'showreel_poster', label: 'Showreel cover image (optional)', type: 'image', folder: 'covers' },
          { k: 'cta_primary', label: 'Main button text', type: 'text' },
          { k: 'cta_secondary', label: 'Second button text', type: 'text' },
        ],
      },
    ],
  },
  about: {
    label: 'About',
    sections: [
      {
        key: 'about',
        title: 'About you',
        fields: [
          { k: 'heading', label: 'Heading', type: 'text' },
          { k: 'bio', label: 'Your story', type: 'textarea', rows: 9, max: 4000, hint: 'Leave a blank line between paragraphs.' },
          { k: 'photo', label: 'Your photo', type: 'image', folder: 'about', hint: 'A portrait photo works best.' },
          { k: 'location', label: 'Based in', type: 'text' },
        ],
      },
    ],
  },
  contact: {
    label: 'Contact and booking',
    sections: [
      {
        key: 'contact',
        title: 'Contact details',
        fields: [
          { k: 'email', label: 'Email', type: 'email' },
          { k: 'whatsapp', label: 'WhatsApp number', type: 'text', hint: 'Digits with country code, no plus sign. Example: 919876543210' },
          { k: 'whatsapp_message', label: 'Message that opens in WhatsApp', type: 'textarea', rows: 2 },
          { k: 'calendly_url', label: 'Calendly link (optional)', type: 'url', hint: 'Used for the Book a call button if you turn the booking form off.' },
        ],
      },
      {
        key: 'booking',
        title: 'Booking form',
        fields: [
          { k: 'enabled', label: 'Show the booking form on the website', type: 'check' },
          { k: 'intro', label: 'Text above the form', type: 'textarea', rows: 2 },
        ],
      },
    ],
  },
  seo: {
    label: 'Look and SEO',
    sections: [
      {
        key: 'theme',
        title: 'Accent colour',
        fields: [{ k: 'accent', label: 'Accent colour', type: 'color', hint: 'Used for buttons, the playhead and highlights.' }],
      },
      {
        key: 'seo',
        title: 'Google and sharing',
        fields: [
          { k: 'title', label: 'Page title', type: 'text', max: 70, hint: 'Shown in Google results and browser tabs. About 60 characters.' },
          { k: 'description', label: 'Description', type: 'textarea', rows: 3, max: 200, hint: 'Shown under the title in Google. About 150 characters.' },
          { k: 'og_image', label: 'Sharing image', type: 'image', folder: 'share', hint: 'Shown when the link is shared on WhatsApp, Instagram or LinkedIn. 1200 x 630 works best.' },
        ],
      },
    ],
  },
};
