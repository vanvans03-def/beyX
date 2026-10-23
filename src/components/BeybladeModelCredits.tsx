import { BEYBLADE_MODELS } from '@/data/beyblade-models';

export function BeybladeModelCredits({ english }: { english: boolean }) {
    return <details className="text-[10px] normal-case tracking-normal text-muted-foreground/60">
        <summary className="min-h-8 cursor-pointer py-2">{english ? '3D model credits' : 'เครดิตโมเดล 3D'}</summary>
        <p>Toys, Games &amp; hobbies (@tgh14) · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer" className="underline">CC BY-NC-SA 4.0</a></p>
        <div className="flex flex-wrap gap-3 py-2">{BEYBLADE_MODELS.map(blade => <a key={blade.name} href={blade.source} target="_blank" rel="noreferrer" className="underline">{blade.name}</a>)}</div>
    </details>;
}
