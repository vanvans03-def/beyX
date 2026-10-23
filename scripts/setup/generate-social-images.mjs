import fs from 'node:fs/promises';
import sharp from 'sharp';

// Deterministic vector artwork, not generated imagery. No runtime rendering cost.
for (const bracket of [false, true]) {
    const lines = bracket
        ? '<path d="M834 215h62v82h58m-120 83h62v-83m58 0h54v83h54m-108 83h54v-83" fill="none" stroke="#00df99" stroke-width="5"/><g fill="#14271f" stroke="#365447" stroke-width="2"><rect x="778" y="193" width="98" height="44" rx="8"/><rect x="778" y="358" width="98" height="44" rx="8"/><rect x="928" y="275" width="98" height="44" rx="8"/><rect x="928" y="441" width="98" height="44" rx="8"/><rect x="1050" y="358" width="76" height="44" rx="8"/></g><path d="M796 215h40m-40 165h40m110-83h40m-40 166h40" stroke="#88a398" stroke-width="4" stroke-linecap="round"/>'
        : '<circle cx="951" cy="328" r="148" fill="none" stroke="#284738" stroke-width="2"/><circle cx="951" cy="328" r="113" fill="none" stroke="#284738" stroke-width="2"/><path d="m872 250 158 156m0-156L872 406" stroke="#00df99" stroke-width="26"/><path d="M790 328h30m262 0h30M951 166v30m0 264v30" stroke="#00df99" stroke-width="3"/>';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <rect width="1200" height="630" fill="#080f0c"/><path d="M0 0h1200v10H0z" fill="#00df99"/>
      <path d="M740 0v630M0 526h1200" stroke="#26372e"/>
      <path d="M790 0v630m80-630v630m80-630v630m80-630v630m80-630v630M740 90h460m-460 80h460m-460 80h460m-460 80h460m-460 80h460m-460 80h460" stroke="#18261e"/>
      <g font-family="Arial,Helvetica,sans-serif"><text x="66" y="83" fill="#00df99" font-size="18" font-weight="700" letter-spacing="4">BEYX / ARENA SYSTEM</text>
      <text x="60" y="252" fill="#f5f8f6" font-size="112" font-weight="900" letter-spacing="-6">BEYX</text>
      <text x="60" y="360" fill="#00df99" font-size="112" font-weight="900" letter-spacing="-6">${bracket ? 'BRACKET.' : 'SYSTEM.'}</text>
      <text x="66" y="424" fill="#b3c3ba" font-size="22" letter-spacing="1">${bracket ? 'FOLLOW THE MATCH. FEEL THE MOMENT.' : 'PLAY. ORGANIZE. COMPETE.'}</text>
      <text x="66" y="572" fill="#f5f8f6" font-size="19" font-weight="700">beyx-system.com</text>
      <text x="1134" y="572" fill="#8da497" font-size="14" text-anchor="end" letter-spacing="2">BEYBLADE X / ${bracket ? 'TOURNAMENT BRACKET' : 'TOURNAMENT PLATFORM'}</text></g>
      ${lines}
    </svg>`;
    const name = bracket ? 'beyx-bracket-v2' : 'beyx-share-v2';
    await fs.writeFile(`public/${name}.svg`, svg);
    await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(`public/${name}.png`);
    console.log(`public/${name}.png (1200 x 630)`);
}
