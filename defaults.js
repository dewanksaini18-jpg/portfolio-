// Starter content. Used (1) by the website until the database has content, and
// (2) by the dashboard's "Load starter content" button.
//
// Rule for this file: nothing invented. Anything that needs the owner's real facts
// (clients, testimonials, numbers, policies, bio, videos) is an obvious
// placeholder flagged with `placeholder: true` / `is_placeholder: true`.
// The flag clears itself the moment an item is edited and saved in the dashboard.

export const DEFAULT_SETTINGS = {
  brand: {
    name: 'WOLF EDIT',
    owner: 'Dewank Saini',
    logo: '/assets/wolf-edit-logo.webp',
    role: 'Video Editor & Motion Designer',
    tagline: 'Your vision. My edit. One powerful story.',
    availability_on: false,
    availability_text: 'Open for new projects',
  },
  hero: {
    intro: 'Reels, YouTube videos, motion graphics and cinematic showreels for creators and brands.',
    showreel_url: '',
    showreel_poster: '',
    cta_primary: 'Book a call',
    cta_secondary: 'See my work',
  },
  about: {
    heading: 'Editing is how I tell your story.',
    bio: 'Add your story here.\n\nWho you are, when you started editing, and what you care about in a cut.',
    photo: '',
    location: 'India',
    placeholder: true,
  },
  contact: {
    email: 'dewanksaini18@gmail.com',
    whatsapp: '918053352071',
    whatsapp_message: "Hi, I saw your Wolf Edit portfolio and I'd like to talk about a video project.",
    calendly_url: '',
  },
  booking: {
    enabled: true,
    intro: 'Tell me about your project and I will get back to you.',
  },
  seo: {
    title: 'WOLF EDIT | Video Editor & Motion Designer',
    description:
      'Wolf Edit is the video editing and motion design portfolio of Dewank Saini. Reels, YouTube videos, motion graphics and cinematic showreels.',
    og_image: '/assets/wolf-edit-share.png',
  },
  theme: {
    accent: '#C6FF1A',
  },
};

const ph = 'Replace this with your own video in Admin > Projects.';

export const DEFAULT_PROJECTS = [
  { title: 'Your reel goes here', category: 'Reels', aspect: 'portrait', featured: true },
  { title: 'Your YouTube edit goes here', category: 'YouTube', aspect: 'landscape', featured: true },
  { title: 'Your motion graphics go here', category: 'Motion graphics', aspect: 'landscape', featured: true },
  { title: 'Your short-form edit goes here', category: 'Short-form', aspect: 'portrait', featured: true },
  { title: 'Your cinematic showreel goes here', category: 'Showreel', aspect: 'landscape', featured: false },
  { title: 'Your client project goes here', category: 'YouTube', aspect: 'landscape', featured: false },
].map((p, i) => ({
  ...p,
  slug: `placeholder-${i + 1}`,
  description: ph,
  client: '',
  video_url: '',
  thumbnail_url: '',
  published: true,
  is_placeholder: true,
  position: i,
}));

export const DEFAULT_ITEMS = {
  services: [
    {
      title: 'Reels and short-form',
      description:
        'Vertical edits for Instagram Reels, YouTube Shorts and TikTok, paced and captioned for the platform.',
      deliverables: ['Instagram Reels', 'YouTube Shorts', 'TikTok'],
    },
    {
      title: 'YouTube videos',
      description: 'Long-form edits with a clear story: cuts, b-roll, graphics, music and a clean final export.',
      deliverables: ['Full edit', 'Graphics and titles', 'Music and sound'],
    },
    {
      title: 'Motion graphics',
      description: 'Titles, lower thirds, animated logos and overlays built in After Effects.',
      deliverables: ['Titles', 'Lower thirds', 'Logo animation'],
    },
    {
      title: 'Cinematic showreels',
      description: 'A short film that puts your best work in one well-paced reel.',
      deliverables: ['Reel edit', 'Colour and sound', 'Export for web'],
    },
  ],

  testimonials: [
    { quote: 'Replace this with a real testimonial from one of your clients.', name: 'Client name', role: 'Role, company', avatar: '', placeholder: true },
    { quote: 'Replace this with a real testimonial from one of your clients.', name: 'Client name', role: 'Role, company', avatar: '', placeholder: true },
    { quote: 'Replace this with a real testimonial from one of your clients.', name: 'Client name', role: 'Role, company', avatar: '', placeholder: true },
  ],

  faq: [
    { question: 'How long does an edit take?', answer: 'Add your answer here.', placeholder: true },
    { question: 'How many revisions are included?', answer: 'Add your answer here.', placeholder: true },
    { question: 'How do I send my footage?', answer: 'Add your answer here.', placeholder: true },
    { question: 'What do you need from me to start?', answer: 'Add your answer here.', placeholder: true },
    { question: 'Can you work with international clients?', answer: 'Add your answer here.', placeholder: true },
  ],

  process: [
    { title: 'Brief', description: 'You tell me about the video, the audience and the style you want.' },
    { title: 'Footage', description: 'You share your raw files through Google Drive, Dropbox or any link.' },
    { title: 'First cut', description: 'I edit a first version and send it to you for review.' },
    { title: 'Revisions', description: 'You share feedback and I refine the edit.' },
    { title: 'Delivery', description: 'You get the final file in the format you need.' },
  ],

  tools: [
    { name: 'Premiere Pro' },
    { name: 'After Effects' },
    { name: 'DaVinci Resolve' },
    { name: 'Photoshop' },
    { name: 'CapCut' },
    { name: 'Audition' },
  ],

  clients: [
    { name: 'Client name', logo: '', url: '', placeholder: true },
    { name: 'Client name', logo: '', url: '', placeholder: true },
    { name: 'Client name', logo: '', url: '', placeholder: true },
    { name: 'Client name', logo: '', url: '', placeholder: true },
  ],

  stats: [
    { value: '00', label: 'Videos delivered', placeholder: true },
    { value: '00', label: 'Clients served', placeholder: true },
    { value: '00', label: 'Years editing', placeholder: true },
  ],

  socials: [
    { platform: 'Instagram', label: '@Wolf_edit', url: 'https://instagram.com/Wolf_edit' },
    { platform: 'YouTube', label: 'Wolf Edit', url: 'https://youtube.com/@dewank-h9z' },
    { platform: 'LinkedIn', label: '', url: '' },
  ],
};

export const SOCIAL_PLATFORMS = [
  'Instagram', 'YouTube', 'LinkedIn', 'Behance', 'X', 'Facebook', 'TikTok', 'Vimeo', 'Threads', 'Telegram', 'Website',
];
