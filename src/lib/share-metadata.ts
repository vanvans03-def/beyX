import type { Metadata } from 'next';

export const siteOrigin = new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://beyx-system.com').origin;

/** Public, static images: no auth, database reads, or runtime image generation. */
export function shareMetadata(title: string, description: string, path: string, bracket = false): Metadata {
    const url = new URL(path, siteOrigin).href;
    const image = new URL(bracket ? '/beyx-bracket-v2.png' : '/beyx-share-v2.png', siteOrigin).href;
    return {
        title, description,
        alternates: { canonical: url },
        openGraph: {
            title, description, url, siteName: 'BeyX System', type: 'website', locale: 'th_TH',
            images: [{ url: image, secureUrl: image.startsWith('https:') ? image : undefined,
                width: 1200, height: 630, type: 'image/png', alt: bracket ? 'BeyX — สายการแข่งขัน Beyblade X' : 'BeyX System — Play. Organize. Compete.' }],
        },
        twitter: { card: 'summary_large_image', title, description, images: [image] },
    };
}
