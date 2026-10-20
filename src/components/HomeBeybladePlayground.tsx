'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { BEYBLADE_MODELS } from '@/data/beyblade-models';
import { advancePlaygroundBody, bounceAtEdges, collidePlaygroundBodies } from '@/lib/beyblade-playground-physics';

type Actions = { drag: (index: number, x: number, y: number) => void; release: (index: number) => void; move: (index: number, x: number, y: number) => void; reset: () => void; refresh: () => void };

export default function HomeBeybladePlayground({ lang }: { lang: string }) {
    const zone = useRef<HTMLDivElement>(null);
    const canvasHost = useRef<HTMLDivElement>(null);
    const handles = useRef<(HTMLButtonElement | null)[]>([]);
    const actions = useRef<Actions | null>(null);
    const dragging = useRef<{ index: number; id: number; dx: number; dy: number } | null>(null);
    const paused = useRef(false);
    const [isPaused, setPaused] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);
    const english = lang === 'EN';

    useEffect(() => {
        const host = canvasHost.current, area = zone.current;
        if (!host || !area) return;
        let disposed = false;
        let cleanup = () => {};
        void Promise.all([import('three'), import('three/addons/loaders/GLTFLoader.js')]).then(async ([T, { GLTFLoader }]) => {
            if (disposed) return;
            let renderer: InstanceType<typeof T.WebGLRenderer>;
            try { renderer = new T.WebGLRenderer({ alpha: true, antialias: true }); }
            catch { setError(true); return; }
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
            host.appendChild(renderer.domElement);
            const scene = new T.Scene();
            const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
            camera.position.z = 500;
            scene.add(new T.HemisphereLight(0xe8f8ff, 0x203b45, 3));
            const key = new T.DirectionalLight(0xffffff, 4); key.position.set(-100, 200, 400); scene.add(key);
            const fill = new T.DirectionalLight(0x91ffe4, 2); fill.position.set(200, -100, 200); scene.add(fill);
            const resources = new Set<{ dispose: () => void }>();
            const abort = new AbortController();
            let width = window.innerWidth, height = window.innerHeight, time = 0, previous = 0, inView = true;
            const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
            const bodies = BEYBLADE_MODELS.map(() => {
                const tilt = new T.Group(); tilt.rotation.x = 1; scene.add(tilt);
                const spin = new T.Group(); tilt.add(spin);
                return { tilt, spin, x: 0, y: 0, vx: 0, vy: 0, lastDrag: 0, held: false, returnAfter: 0, ready: false };
            });
            const placeInZone = () => {
                const rect = area.getBoundingClientRect();
                bodies.forEach((body, index) => { body.x = rect.left + rect.width * (index === 0 ? 0.28 : 0.72); body.y = rect.top + 64; body.vx = body.vy = 0; body.returnAfter = 0; body.held = false; bounceAtEdges(body, width, height); });
            };
            const resolveContacts = () => {
                // Repeat separation so a pushed body cannot get trapped against a wall.
                for (let pass = 0; pass < 3; pass++) {
                    collidePlaygroundBodies(bodies[0], bodies[1], time);
                    bodies.forEach(body => bounceAtEdges(body, width, height));
                }
            };
            const draw = () => {
                bodies.forEach((body, index) => {
                    body.tilt.visible = body.ready && inView;
                    body.tilt.position.set(body.x - width / 2, height / 2 - body.y, 0);
                    const handle = handles.current[index];
                    if (handle) { handle.style.transform = `translate3d(${body.x - 44}px, ${body.y - 44}px, 0)`; handle.style.visibility = body.ready && inView ? 'visible' : 'hidden'; }
                });
                renderer.render(scene, camera);
            };
            const frame = (now: number) => {
                const dt = Math.min((now - previous) / 1000, 0.05); previous = now;
                time += dt;
                const rect = area.getBoundingClientRect();
                bodies.forEach((body, index) => {
                    if (!paused.current && !motion.matches) body.spin.rotation.y += dt * (body.held ? 8 : 3);
                    if (!paused.current && !motion.matches && !body.held && time >= body.returnAfter) {
                        const x = rect.left + rect.width * (index === 0 ? 0.28 : 0.72) + Math.sin(time * 0.9 + index * 2.7) * rect.width * 0.13;
                        const y = rect.top + 64 + Math.cos(time * 1.25 + index * 2) * 21;
                        body.vx += (x - body.x) * 5 * dt;
                        body.vy += (y - body.y) * 5 * dt;
                    }
                });
                if (!paused.current && !motion.matches) {
                    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
                    for (let step = 0; step < steps; step++) {
                        bodies.forEach(body => advancePlaygroundBody(body, dt / steps, width, height));
                        resolveContacts();
                    }
                }
                draw();
            };
            const refresh = () => {
                previous = performance.now();
                renderer.setAnimationLoop(inView && !document.hidden && !paused.current && !motion.matches ? frame : null);
                draw();
            };
            const resize = () => {
                width = window.innerWidth; height = window.innerHeight;
                renderer.setSize(width, height); camera.left = -width / 2; camera.right = width / 2; camera.top = height / 2; camera.bottom = -height / 2; camera.updateProjectionMatrix();
                placeInZone(); draw();
            };
            actions.current = {
                drag: (index, x, y) => {
                    const body = bodies[index], now = performance.now();
                    const dt = Math.max(1 / 120, (now - body.lastDrag) / 1000);
                    const dx = x - body.x, dy = y - body.y;
                    body.vx = T.MathUtils.clamp(dx / dt, -1200, 1200); body.vy = T.MathUtils.clamp(dy / dt, -1200, 1200);
                    body.lastDrag = now; body.held = true;
                    // Sweep the drag path, including large pointer jumps, to avoid tunnelling.
                    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 12));
                    for (let step = 0; step < steps; step++) { body.x += dx / steps; body.y += dy / steps; bounceAtEdges(body, width, height); resolveContacts(); }
                    draw();
                },
                release: index => { const body = bodies[index]; if (!body.held) return; body.held = false; body.returnAfter = time + 4; if (performance.now() - body.lastDrag > 100) body.vx = body.vy = 0; },
                move: (index, x, y) => { const body = bodies[index]; body.x += x; body.y += y; body.vx = x * 12; body.vy = y * 12; body.returnAfter = time + 4; bounceAtEdges(body, width, height); resolveContacts(); draw(); },
                reset: () => { placeInZone(); draw(); }, refresh,
            };
            const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; refresh(); }); observer.observe(area);
            const scroll = () => { if (!dragging.current) placeInZone(); refresh(); };
            window.addEventListener('resize', resize); window.addEventListener('scroll', scroll, { passive: true });
            document.addEventListener('visibilitychange', refresh); motion.addEventListener('change', refresh);
            cleanup = () => {
                abort.abort(); observer.disconnect(); actions.current = null;
                window.removeEventListener('resize', resize); window.removeEventListener('scroll', scroll);
                document.removeEventListener('visibilitychange', refresh); motion.removeEventListener('change', refresh);
                renderer.setAnimationLoop(null); resources.forEach(resource => resource.dispose()); renderer.dispose(); renderer.domElement.remove();
            };
            resize(); refresh();
            const loader = new GLTFLoader();
            await Promise.all(BEYBLADE_MODELS.map(async (blade, index) => {
                const response = await fetch(blade.file, { signal: abort.signal });
                if (!response.ok) throw new Error(`Model download failed: ${response.status}`);
                const data = await response.arrayBuffer(); if (disposed) return;
                const gltf = await loader.parseAsync(data, '/models/beyblade/');
                const owned = new Set<{ dispose: () => void }>();
                gltf.scene.traverse(object => {
                    if (!(object instanceof T.Mesh)) return;
                    owned.add(object.geometry);
                    const mats = Array.isArray(object.material) ? object.material : [object.material];
                    mats.forEach(mat => { owned.add(mat); Object.values(mat).forEach(value => { if (value instanceof T.Texture) owned.add(value); }); });
                });
                if (disposed) { owned.forEach(resource => resource.dispose()); return; }
                owned.forEach(resource => resources.add(resource));
                const box = new T.Box3().setFromObject(gltf.scene), size = box.getSize(new T.Vector3()), center = box.getCenter(new T.Vector3());
                const scale = 72 / Math.max(size.x, size.z);
                gltf.scene.scale.setScalar(scale); gltf.scene.position.copy(center.multiplyScalar(-scale));
                bodies[index].spin.add(gltf.scene); bodies[index].ready = true; draw();
            }));
            if (!disposed) setLoaded(true);
        }).catch(reason => { if (!disposed && reason.name !== 'AbortError') { setError(true); console.warn('Home Beyblades unavailable', reason); } });
        return () => { disposed = true; cleanup(); };
    }, []);

    return <>
        <div ref={zone} className="relative h-[170px] w-full" aria-label={english ? 'Beyblade playground' : 'ลูกข่างเล่นบนหน้าแรก'}>
            <div className="absolute inset-x-0 bottom-0 space-y-2 text-center">
                <p role="status" className="text-xs text-muted-foreground">{error ? (english ? '3D is unavailable on this browser' : 'เบราว์เซอร์นี้เปิดลูกข่าง 3D ไม่ได้') : !loaded ? (english ? 'Loading Beyblades…' : 'กำลังโหลดลูกข่าง…') : (english ? 'Drag the Beyblades anywhere · Arrow keys work too' : 'ลากลูกข่างไปเล่นได้ทั่วหน้าจอ · ใช้ปุ่มลูกศรได้ด้วย')}</p>
                <div className="flex justify-center gap-3 text-[11px] text-muted-foreground">
                    <button type="button" disabled={!loaded} onClick={() => { paused.current = !paused.current; setPaused(paused.current); actions.current?.refresh(); }} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:text-primary disabled:opacity-40">{isPaused ? <Play size={12} /> : <Pause size={12} />}{isPaused ? (english ? 'Animate' : 'ให้วิ่งเล่น') : (english ? 'Pause' : 'พักลูกข่าง')}</button>
                    <button type="button" disabled={!loaded} onClick={() => actions.current?.reset()} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:text-primary disabled:opacity-40"><RotateCcw size={12} />{english ? 'Bring back' : 'เรียกกลับ'}</button>
                </div>
            </div>
        </div>
        <details className="!mt-2 text-[10px] text-muted-foreground/60"><summary className="cursor-pointer">{english ? '3D model credits' : 'เครดิตโมเดล 3D'}</summary><p>Toys, Games &amp; hobbies (@tgh14) · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer" className="underline">CC BY-NC-SA 4.0</a></p><div className="flex justify-center gap-3">{BEYBLADE_MODELS.map(blade => <a key={blade.name} href={blade.source} target="_blank" rel="noreferrer" className="underline">{blade.name}</a>)}</div></details>
        {typeof document !== 'undefined' && createPortal(<div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-label={english ? 'Interactive Beyblades' : 'ลูกข่างที่ขยับเล่นได้'}>
            <div ref={canvasHost} className="absolute inset-0" aria-hidden="true" />
            {BEYBLADE_MODELS.map((blade, index) => <button key={blade.name} ref={node => { handles.current[index] = node; }} type="button" aria-label={`${english ? 'Drag' : 'ลาก'} ${blade.name}`} title={blade.name} style={{ visibility: 'hidden' }} className="pointer-events-auto absolute left-0 top-0 h-[88px] w-[88px] cursor-grab touch-none rounded-full outline-none hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing"
                onPointerDown={event => {
                    if (!event.isPrimary || event.button !== 0) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    dragging.current = { index, id: event.pointerId, dx: event.clientX - rect.left - 44, dy: event.clientY - rect.top - 44 };
                    event.currentTarget.setPointerCapture(event.pointerId);
                    actions.current?.drag(index, rect.left + 44, rect.top + 44);
                }}
                onPointerMove={event => { const drag = dragging.current; if (drag?.id === event.pointerId && drag.index === index) actions.current?.drag(index, event.clientX - drag.dx, event.clientY - drag.dy); }}
                onPointerUp={event => { if (dragging.current?.id !== event.pointerId) return; dragging.current = null; actions.current?.release(index); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
                onPointerCancel={() => { dragging.current = null; actions.current?.release(index); }}
                onLostPointerCapture={() => { dragging.current = null; actions.current?.release(index); }}
                onKeyDown={event => {
                    const directions: Record<string, [number, number]> = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] };
                    if (directions[event.key]) { event.preventDefault(); actions.current?.move(index, ...directions[event.key]); }
                    if (event.key === 'Escape') actions.current?.reset();
                }}><span className="sr-only">{blade.name}</span></button>)}
        </div>, document.body)}
    </>;
}
