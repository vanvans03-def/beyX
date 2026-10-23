import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = process.argv[2] || 'test-results/migration';
for (const project of ['desktop', 'mobile', 'ipad']) {
    const folder = fs.readdirSync(root).find(name => name.startsWith('motion-ui-') && name.endsWith(`-${project}`));
    if (!folder) continue;
    const files = fs.readdirSync(path.join(root, folder)).filter(name => /^\d+-page\.png$/.test(name)).sort();
    const width = project === 'desktop' ? 360 : 260, height = project === 'desktop' ? 225 : 370, columns = 4;
    const composites = [];
    for (const [index, file] of files.entries()) {
        const left = index % columns * width, top = Math.floor(index / columns) * (height + 24);
        composites.push({ input: Buffer.from(`<svg width="${width}" height="24"><rect width="100%" height="100%" fill="#13271c"/><text x="8" y="17" fill="white" font-size="13">${project} / ${file.slice(0, 2)}</text></svg>`), left, top });
        composites.push({ input: await sharp(path.join(root, folder, file)).resize(width, height, { fit: 'contain', background: '#060606' }).png().toBuffer(), left, top: top + 24 });
    }
    if (files.length) {
        const destination = path.join(root, `motion-${project}-contact.png`);
        await sharp({ create: { width: columns * width, height: Math.ceil(files.length / columns) * (height + 24), channels: 3, background: '#060606' } }).composite(composites).png().toFile(destination);
        console.log(`${project}: ${files.length} screenshots -> ${destination}`);
    }
}
