import type { MetadataRoute } from 'next';

/**
 * Web app manifest, so the game can be installed to a home screen.
 *
 * `display: standalone` drops the browser chrome, which matters here: the board
 * is sized to exactly one viewport, and an address bar that appears and
 * disappears would keep changing what "one viewport" means.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LACUNO',
    short_name: 'LACUNO',
    description: 'A daily word puzzle. Fill the gaps in the phrase.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f3040',
    theme_color: '#a56f63',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        // The logo is a full-bleed square, so it survives the circular and
        // squircle masks Android applies.
        purpose: 'maskable',
      },
    ],
  };
}
