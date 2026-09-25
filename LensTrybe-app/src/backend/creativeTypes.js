// Single source of truth for the creative disciplines LensTrybe offers.
//
// LAUNCH SCOPE: Photographers and Videographers only. The other disciplines
// (Drone Pilot, Video Editor, Photo Editor, Social Media Manager,
// Hair & Makeup Artist, UGC Creator) are planned for after launch. When they
// return, add them back to CREATIVE_TYPES (and their specialties below) and
// every picker, filter and search across the app updates automatically.

export const CREATIVE_TYPES = ['Photographer', 'Videographer']

// {value, label} shape for filters that want it (e.g. Find a Creative).
export const CREATIVE_TYPE_OPTIONS = CREATIVE_TYPES.map((t) => ({ value: t, label: t }))

// Sub-specialties per discipline (only the launch types are needed now).
export const CREATIVE_SPECIALTIES = {
  Photographer: [
    'Wedding', 'Portrait', 'Commercial', 'Real Estate', 'Events', 'Fashion',
    'Product', 'Sports', 'Street', 'Architecture', 'Food', 'Newborn & Family',
    'Maternity', 'Boudoir', 'Pet', 'School', 'Headshots', 'Documentary',
    'Travel', 'Fine Art', 'Aerial', 'Night & Astro', 'Corporate',
  ],
  Videographer: [
    'Wedding', 'Brand Film', 'Documentary', 'Events', 'Music Video',
    'Social Media', 'Corporate', 'Sport', 'Real Estate', 'Travel',
    'Short Film', 'Commercial', 'Aerial', 'News & Journalism',
  ],
}
