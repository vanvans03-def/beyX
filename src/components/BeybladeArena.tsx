'use client';

import { useEffect, useRef, useState } from 'react';
import { Maximize2, Pause, Play, RotateCcw, Swords, Zap } from 'lucide-react';
import { BeybladeGame, ARENA_RADIUS, DASH_GATES, FINISH_ZONES, finishZoneAt, xtremeRailPoint, type Phase } from '@/lib/beyblade-game';
import { createBeybladeImpacts } from '@/lib/beyblade-impact-effects';
import { BEYBLADE_MODELS as blades } from '@/data/beyblade-models';

const initialHud = { phase: 'idle' as Phase, count: '3', progress: 0, player: 100, bot: 100, charge: 0, quality: -1, hits: 0, winner: null as number | null, reason: 'spin', skill: false };

export default function BeybladeArena({ compact = false, lang = 'th' }: { compact?: boolean; lang?: string }) {
    const host = useRef<HTMLDivElement>(null);
    const panel = useRef<HTMLElement>(null);
    const game = useRef(new BeybladeGame());
    const paused = useRef(false);
    const [isPaused, setPaused] = useState(false);
    const [selected, setSelected] = useState(0);
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);
    const [models, setModels] = useState([false, false]);
    const [modelError, setModelError] = useState(false);
    const [hud, setHud] = useState(initialHud);
    const english = lang.toLowerCase() === 'en';
    const sync = () => {
        const g = game.current;
        setHud({ phase: g.phase, count: g.elapsed < 3 ? String(Math.max(1, 3 - Math.floor(g.elapsed))) : 'GO SHOOT!', progress: g.launchProgress, player: g.fighters[g.selected].stamina, bot: g.fighters[1 - g.selected].stamina, charge: g.fighters[g.selected].charge, quality: g.quality, hits: g.hits, winner: g.winner, reason: g.reason, skill: g.skill > 0 });
    };

    useEffect(() => {
        const container = host.current;
        if (!container) return;
        let disposed = false;
        let cleanup = () => {};
        void Promise.all([import('three'), import('three/addons/loaders/GLTFLoader.js')]).then(([T, { GLTFLoader }]) => {
            if (disposed) return;
            let renderer: InstanceType<typeof T.WebGLRenderer>;
            try { renderer = new T.WebGLRenderer({ alpha: true, antialias: true }); }
            catch { setFailed(true); return; }
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
            renderer.outputColorSpace = T.SRGBColorSpace;
            container.appendChild(renderer.domElement);
            renderer.domElement.setAttribute('aria-hidden', 'true');
            const scene = new T.Scene();
            const camera = new T.PerspectiveCamera(40, 1, 0.1, 80);
            camera.position.set(0, 12, 8.5); camera.lookAt(0, 0, 0);
            scene.add(new T.HemisphereLight(0xd4efff, 0x15251f, 3));
            const key = new T.DirectionalLight(0xffffff, 4); key.position.set(3, 8, 4); scene.add(key);
            const rim = new T.PointLight(0x00ff94, 35, 20); rim.position.set(-4, 3, -3); scene.add(rim);
            const resources = new Set<{ dispose: () => void }>();
            const track = <U extends { dispose: () => void }>(item: U): U => { resources.add(item); return item; };
            const material = (color: number, metalness = 0.5) => track(new T.MeshStandardMaterial({ color, metalness, roughness: 0.3 }));
            const mesh = (geometry: import('three').BufferGeometry<import('three').NormalBufferAttributes>, mat: InstanceType<typeof T.Material>, parent: InstanceType<typeof T.Object3D> = scene) => {
                const object = new T.Mesh(track(geometry), mat); parent.add(object); return object;
            };
            const stadiumOutline = (radius: number) => {
                const shape = new T.Shape();
                for (let i = 0; i <= 360; i++) {
                    const angle = i / 360 * Math.PI * 2;
                    const r = finishZoneAt(angle) >= 0 ? ARENA_RADIUS - 0.15 : radius;
                    const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
                    if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
                }
                shape.closePath(); return shape;
            };
            const floor = mesh(new T.ExtrudeGeometry(stadiumOutline(5.25), { depth: 0.28, bevelEnabled: false }), material(0x101e24, 0.65));
            floor.rotation.x = Math.PI / 2; floor.position.y = -0.2;
            const bowl = mesh(new T.ShapeGeometry(stadiumOutline(5.15)), material(0x122e31, 0.4)); bowl.rotation.x = Math.PI / 2; bowl.position.y = -0.18;
            (bowl.material as InstanceType<typeof T.MeshStandardMaterial>).side = T.DoubleSide;
            for (const radius of [1.5, 3]) {
                const ring = mesh(new T.TorusGeometry(radius, radius > 4.8 ? 0.045 : 0.012, 8, 100), track(new T.MeshBasicMaterial({ color: radius === 5.2 ? 0x76bfff : 0x00ff94, transparent: true, opacity: radius > 4.8 ? 0.8 : 0.25 })));
                ring.rotation.x = Math.PI / 2; ring.position.y = -0.12;
            }
            FINISH_ZONES.forEach(zone => {
                const pocket = new T.Group(); pocket.rotation.y = -zone.angle;
                pocket.position.set(Math.cos(zone.angle) * 5.5, 0, Math.sin(zone.angle) * 5.5); scene.add(pocket);
                const bottom = mesh(new T.BoxGeometry(1.9, 0.12, 1.95), material(0x05090e), pocket); bottom.position.y = -0.7;
                const edgeMaterial = material(zone.color, 0.65);
                for (const side of [-1, 1]) {
                    const wall = mesh(new T.BoxGeometry(1.9, 0.65, 0.09), edgeMaterial, pocket); wall.position.set(0, -0.34, side * 0.97);
                }
                const back = mesh(new T.BoxGeometry(0.1, 0.65, 2), edgeMaterial, pocket); back.position.set(0.95, -0.34, 0);
                const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = `#${zone.color.toString(16).padStart(6, '0')}`; ctx.font = 'bold 46px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(zone.label, 256, 48);
                    const texture = track(new T.CanvasTexture(canvas));
                    const label = mesh(new T.PlaneGeometry(1.65, 0.32), track(new T.MeshBasicMaterial({ map: texture, transparent: true, side: T.DoubleSide, depthWrite: false })), pocket);
                    label.rotation.x = -Math.PI / 2; label.rotation.z = Math.PI / 2; label.position.set(0.2, -0.62, 0);
                }
            });
            const railPoints = Array.from({ length: 360 }, (_, i) => {
                const point = xtremeRailPoint(i / 360 * Math.PI * 2); return new T.Vector3(point.x, 0.12, point.z);
            });
            const railCurve = new T.CatmullRomCurve3(railPoints, true);
            mesh(new T.TubeGeometry(railCurve, 360, 0.09, 6, true), material(0x12bafa, 0.8));
            const teeth = new T.InstancedMesh(track(new T.BoxGeometry(0.16, 0.18, 0.24)), material(0xa6eaff, 0.85), 180);
            const tooth = new T.Object3D();
            for (let i = 0; i < 180; i++) {
                const a = i / 180 * Math.PI * 2, point = xtremeRailPoint(a), next = xtremeRailPoint(a + 0.005);
                tooth.position.set(point.x, 0.19, point.z); tooth.rotation.y = -Math.atan2(next.z - point.z, next.x - point.x);
                tooth.updateMatrix(); teeth.setMatrixAt(i, tooth.matrix);
            }
            scene.add(teeth);
            for (const angle of DASH_GATES) {
                const gate = new T.Group(); gate.position.set(Math.cos(angle) * 3.45, -0.08, Math.sin(angle) * 3.45); gate.rotation.y = -angle; scene.add(gate);
                mesh(new T.BoxGeometry(0.75, 0.06, 0.55), material(0x103c58), gate);
                for (let i = 0; i < 3; i++) {
                    for (const sign of [-1, 1]) {
                        const arrow = mesh(new T.BoxGeometry(0.28, 0.04, 0.045), track(new T.MeshBasicMaterial({ color: 0xffdc68 })), gate);
                        arrow.position.set(-0.2 + i * 0.22, 0.06, sign * 0.085); arrow.rotation.y = sign * 0.65;
                    }
                }
            }
            const tops = blades.map((blade, index) => {
                const pivot = new T.Group(); scene.add(pivot);
                const spin = new T.Group(); pivot.add(spin);
                const fallback = new T.Group(); spin.add(fallback);
                const silver = material(0xc5d6e4, 0.9), accent = material(blade.color, 0.65);
                mesh(new T.ConeGeometry(0.16, 0.34, 16), accent, fallback).rotation.z = Math.PI;
                const ratchet = mesh(new T.CylinderGeometry(0.27, 0.22, 0.2, 12), accent, fallback); ratchet.position.y = 0.2;
                const bladeMesh = mesh(new T.CylinderGeometry(0.48, 0.4, 0.16, index === 0 ? 6 : 8), silver, fallback); bladeMesh.position.y = 0.36;
                const core = mesh(new T.CylinderGeometry(0.31, 0.34, 0.12, 32), accent, fallback); core.position.y = 0.46;
                const chip = mesh(new T.CylinderGeometry(0.13, 0.15, 0.04, 6), material(0xffdc83, 0.8), fallback); chip.position.y = 0.54;
                for (let j = 0; j < 3; j++) {
                    const tooth = mesh(new T.BoxGeometry(0.26, 0.13, 0.18), accent, fallback);
                    const a = j * Math.PI * 2 / 3; tooth.position.set(Math.cos(a) * 0.37, 0.43, Math.sin(a) * 0.37); tooth.rotation.y = -a + 0.5;
                }
                const halo = mesh(new T.RingGeometry(0.57, 0.62, 48), track(new T.MeshBasicMaterial({ color: blade.color, side: T.DoubleSide, transparent: true, opacity: 0.75 })));
                halo.rotation.x = -Math.PI / 2; halo.position.y = -0.08;
                return { pivot, spin, halo, fallback };
            });
            // Only load creator-provided downloads; never scrape Sketchfab's viewer assets.
            const loader = new GLTFLoader();
            const abort = new AbortController();
            const ownModel = (object: InstanceType<typeof T.Object3D>) => object.traverse(child => {
                if (!(child instanceof T.Mesh)) return;
                track(child.geometry);
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => { track(mat); Object.values(mat).forEach(value => { if (value instanceof T.Texture) track(value); }); });
            });
            blades.forEach((blade, index) => {
                void fetch(blade.file, { signal: abort.signal }).then(async response => {
                    if (!response.ok) throw new Error(`Model download failed: ${response.status}`);
                    const data = await response.arrayBuffer();
                    if (disposed) return;
                    const gltf = await loader.parseAsync(data, '/models/beyblade/');
                    ownModel(gltf.scene);
                    if (disposed) { resources.forEach(item => item.dispose()); return; }
                    const box = new T.Box3().setFromObject(gltf.scene);
                    const size = box.getSize(new T.Vector3());
                    const scale = 0.98 / Math.max(size.x, size.z, 0.001);
                    gltf.scene.scale.setScalar(scale);
                    const center = box.getCenter(new T.Vector3());
                    gltf.scene.position.set(-center.x * scale, -box.min.y * scale - 0.1, -center.z * scale);
                    tops[index].fallback.visible = false;
                    tops[index].spin.add(gltf.scene);
                    setModels(previous => previous.map((value, i) => i === index || value));
                }).catch(error => {
                    if (!disposed && error.name !== 'AbortError') { setModelError(true); console.warn('Beyblade model could not load', error); }
                });
            });
            let previousTime = 0, accumulator = 0, uiTime = 0, visible = true, pointerId: number | null = null;
            const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
            const ray = new T.Raycaster(), point = new T.Vector3(), pointer = new T.Vector2();
            const plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
            const impacts = createBeybladeImpacts(T, scene, resources, 'xz');
            let lastImpact = 0;
            const trails = tops.map((_, i) => Array.from({ length: 12 }, () => {
                const trail = mesh(new T.RingGeometry(0.3, 0.4, 16), track(new T.MeshBasicMaterial({ color: blades[i].color, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending })));
                trail.rotation.x = -Math.PI / 2; return trail;
            }));
            let trailTime = 0, trailIndex = 0;
            const draw = () => {
                const g = game.current;
                tops.forEach(({ pivot, spin, halo }, i) => {
                    const f = g.fighters[i]; pivot.position.set(f.x, f.height + f.fall * 0.26 + (f.railMode === 2 ? 0.22 : 0), f.z);
                    spin.rotation.y = motion.matches ? 0 : f.angle;
                    pivot.rotation.z = f.fall * 1.42 + (f.stamina < 20 && g.phase === 'battle' && !motion.matches ? Math.sin(f.angle * 0.2) * (0.1 + (20 - f.stamina) * 0.012) : 0);
                    halo.position.set(f.x, -0.08, f.z);
                    const scale = i === g.selected ? (g.skill > 0 && !motion.matches ? 1.6 : 1.15) : 0.88; halo.scale.setScalar(scale);
                    (halo.material as InstanceType<typeof T.MeshBasicMaterial>).color.setHex(f.impact > 0 ? 0xffffff : blades[i].color);
                    (halo.material as InstanceType<typeof T.MeshBasicMaterial>).opacity = f.impact > 0 ? 1 : 0.75;
                    halo.visible = f.fall < 0.1;
                });
                if (g.impact && g.impact.id !== lastImpact) { lastImpact = g.impact.id; impacts.burst(g.impact.x, g.impact.z, g.impact.power); }
                if (g.phase === 'idle' || g.phase === 'countdown') { impacts.clear(); trails.flat().forEach(trail => { trail.material.opacity = 0; }); }
                renderer.render(scene, camera);
            };
            const publish = () => {
                const g = game.current;
                setHud({ phase: g.phase, count: g.elapsed < 3 ? String(Math.max(1, 3 - Math.floor(g.elapsed))) : 'GO SHOOT!', progress: g.launchProgress, player: g.fighters[g.selected].stamina, bot: g.fighters[1 - g.selected].stamina, charge: g.fighters[g.selected].charge, quality: g.quality, hits: g.hits, winner: g.winner, reason: g.reason, skill: g.skill > 0 });
            };
            const frame = (now: number) => {
                const dt = Math.min(0.06, Math.max(0, (now - previousTime) / 1000)); previousTime = now;
                if (!paused.current) {
                    impacts.update(dt, motion.matches);
                    accumulator += dt;
                    while (accumulator >= 1 / 120) { game.current.step(1 / 120); accumulator -= 1 / 120; }
                    if (game.current.phase === 'idle' && !motion.matches) game.current.fighters.forEach(f => { f.angle += dt * 1.4; });
                    trails.flat().forEach(trail => { trail.material.opacity = Math.max(0, trail.material.opacity - dt * 1.8); });
                    trailTime += dt;
                    if (trailTime >= 0.035) {
                        trailTime = 0;
                        game.current.fighters.forEach((f, i) => {
                            if (game.current.phase === 'battle' && !motion.matches && (f.railMode === 2 || f.railMode === 3)) {
                                const trail = trails[i][trailIndex % 12]; trail.position.set(f.x, 0.05, f.z); trail.material.opacity = 0.65;
                            }
                        }); trailIndex++;
                    }
                }
                uiTime += dt; if (uiTime >= 0.08 && game.current.phase !== 'idle') { publish(); uiTime = 0; }
                draw();
                if (game.current.phase === 'finished') { publish(); renderer.setAnimationLoop(null); }
            };
            const updateLoop = () => {
                previousTime = performance.now(); accumulator = 0;
                if (document.hidden || !visible) {
                    if (['countdown', 'battle', 'finishing'].includes(game.current.phase)) { paused.current = true; setPaused(true); game.current.keys.clear(); game.current.target = null; }
                }
                const phase = game.current.phase;
                renderer.setAnimationLoop(visible && !document.hidden && !paused.current && phase !== 'finished' && !(motion.matches && phase === 'idle') ? frame : null);
                publish(); draw();
            };
            const steer = (event: PointerEvent) => {
                const rect = container.getBoundingClientRect();
                pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
                ray.setFromCamera(pointer, camera);
                if (ray.ray.intersectPlane(plane, point)) {
                    const radius = Math.hypot(point.x, point.z), scale = radius > ARENA_RADIUS ? ARENA_RADIUS / radius : 1;
                    game.current.target = { x: point.x * scale, z: point.z * scale };
                }
            };
            const down = (event: PointerEvent) => {
                if (!event.isPrimary || event.button !== 0 || paused.current) return;
                container.focus({ preventScroll: true });
                if (game.current.phase !== 'battle') return;
                pointerId = event.pointerId; container.setPointerCapture(event.pointerId); steer(event);
            };
            const move = (event: PointerEvent) => { if (event.pointerId === pointerId && !paused.current) steer(event); };
            const up = (event: PointerEvent) => {
                if (event.pointerId !== pointerId) return; pointerId = null; game.current.target = null;
                if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
            };
            const keydown = (event: KeyboardEvent) => {
                const k = event.key.length === 1 ? event.key.toLowerCase() : event.key;
                if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 'a', 's', 'd', ' ', 'e'].includes(k)) {
                    event.preventDefault(); if (paused.current) return;
                    if (k === ' ' && !event.repeat) game.current.launch();
                    else if (k === 'e' && !event.repeat) game.current.special();
                    else game.current.keys.add(k);
                }
            };
            const keyup = (event: KeyboardEvent) => game.current.keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
            const blur = () => { game.current.keys.clear(); game.current.target = null; };
            const resize = new ResizeObserver(() => {
                const width = container.clientWidth, height = container.clientHeight;
                renderer.setSize(width, height); camera.aspect = width / Math.max(1, height);
                const distance = camera.aspect < 1 ? 20 / camera.aspect : 20;
                camera.position.set(0, distance * 0.82, distance * 0.57); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); draw();
            }); resize.observe(container);
            const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; updateLoop(); }); observer.observe(container);
            const contextLost = (event: Event) => { event.preventDefault(); paused.current = true; setPaused(true); setReady(false); setFailed(true); renderer.setAnimationLoop(null); };
            container.addEventListener('pointerdown', down); container.addEventListener('pointermove', move);
            container.addEventListener('pointerup', up); container.addEventListener('pointercancel', up); container.addEventListener('lostpointercapture', up);
            container.addEventListener('keydown', keydown); container.addEventListener('keyup', keyup); container.addEventListener('blur', blur);
            container.addEventListener('arena-update', updateLoop); document.addEventListener('visibilitychange', updateLoop);
            motion.addEventListener('change', updateLoop);
            renderer.domElement.addEventListener('webglcontextlost', contextLost);
            setReady(true); updateLoop();
            cleanup = () => {
                abort.abort(); observer.disconnect(); resize.disconnect(); renderer.setAnimationLoop(null);
                container.removeEventListener('pointerdown', down); container.removeEventListener('pointermove', move);
                container.removeEventListener('pointerup', up); container.removeEventListener('pointercancel', up); container.removeEventListener('lostpointercapture', up);
                container.removeEventListener('keydown', keydown); container.removeEventListener('keyup', keyup); container.removeEventListener('blur', blur);
                container.removeEventListener('arena-update', updateLoop); document.removeEventListener('visibilitychange', updateLoop);
                motion.removeEventListener('change', updateLoop);
                renderer.domElement.removeEventListener('webglcontextlost', contextLost);
                resources.forEach(item => item.dispose()); renderer.dispose(); renderer.domElement.remove();
            };
        }).catch(error => { if (!disposed) setFailed(true); console.warn('Arena unavailable', error); });
        return () => { disposed = true; cleanup(); };
    }, []);

    const refresh = () => { sync(); host.current?.dispatchEvent(new Event('arena-update')); };
    const start = () => { paused.current = false; setPaused(false); game.current.start(); refresh(); host.current?.focus({ preventScroll: true }); };
    const launch = () => { if (!paused.current) { game.current.launch(); refresh(); } };
    const active = hud.phase === 'countdown' || hud.phase === 'battle' || hud.phase === 'finishing';
    const button = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-gray-200 transition hover:border-primary/50 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40';
    const qualityLabel = hud.quality >= 0.85 ? 'PERFECT!' : hud.quality >= 0.45 ? 'GOOD!' : 'MISS';
    return (
        <section ref={panel} className="relative isolate min-w-0 overflow-hidden rounded-3xl border border-primary/20 bg-[radial-gradient(ellipse_at_center,_#0e3032_0%,_#081310_60%,_#060a0c_100%)] text-white">
            <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
                <div><p className="text-[10px] font-black tracking-[0.3em] text-primary">BEYX • BATTLE LAB</p><h2 className="mt-1 text-xl font-black italic">{english ? 'Your launch. Your battle.' : 'จับจังหวะปล่อย แล้วลุย!'}</h2></div>
                <button type="button" className={button} aria-label={english ? 'Fullscreen arena' : 'ขยายเต็มจอ'} onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void panel.current?.requestFullscreen?.().catch(() => {}); }}><Maximize2 size={15} /></button>
            </header>
            <div className="mt-4 grid grid-cols-2 gap-2 px-4">
                {blades.map((blade, i) => <button key={blade.name} type="button" disabled={active} aria-pressed={selected === i} className={`${button} flex-col !gap-0.5 ${selected === i ? '!border-primary/50 !bg-primary/10 !text-primary' : ''}`} onClick={() => { setSelected(i); game.current.reset(i); refresh(); }}><span>{blade.name}</span><span className="text-[10px] opacity-60">{blade.parts} · {selected === i ? (english ? 'YOU' : 'คุณ') : 'BOT'}</span></button>)}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 px-5 text-[10px] font-bold tracking-wider">
                {[{ name: english ? 'YOU · SPIN' : 'คุณ · พลังหมุน', value: hud.player, color: 'bg-primary' }, { name: 'BOT · SPIN', value: hud.bot, color: 'bg-pink-400' }].map(bar => <div key={bar.name}><div className="mb-1 flex justify-between"><span>{bar.name}</span><span>{Math.ceil(bar.value)}%</span></div><div role="progressbar" aria-label={bar.name} aria-valuenow={Math.ceil(bar.value)} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full ${bar.color}`} style={{ width: `${bar.value}%` }} /></div></div>)}
            </div>
            <div className="relative">
                <div ref={host} role="group" tabIndex={0} aria-label={english ? 'Battle arena. WASD or arrow keys to steer, Space to launch, E for special.' : 'สนามมินิเกม ใช้ WASD หรือปุ่มลูกศรบังคับ Space ปล่อยลูกข่าง E ใช้ไม้ตาย'} className={`touch-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${compact ? 'h-[330px] sm:h-[400px]' : 'h-[360px] sm:h-[460px]'} [section:fullscreen_&]:h-[55vh]`} />
                {!ready && <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-gray-400">{failed ? (english ? '3D is unavailable. Try a browser with WebGL2.' : 'เปิดสนาม 3D ไม่ได้ กรุณาใช้เบราว์เซอร์ที่รองรับ WebGL2') : (english ? 'Preparing arena…' : 'กำลังเตรียมสนาม…')}</div>}
                {hud.phase === 'countdown' && <div className="pointer-events-none absolute inset-x-0 top-6 text-center"><span className="text-5xl font-black italic text-primary drop-shadow-[0_0_20px_#00ff94]">{hud.count}</span>{hud.quality >= 0 && <p className="mt-2 text-lg font-black">{qualityLabel}</p>}</div>}
                {hud.phase === 'finished' && <div role="status" className="pointer-events-none absolute inset-x-4 top-6 rounded-2xl border border-primary/30 bg-black/85 p-4 text-center"><p className="text-3xl font-black italic text-primary">{hud.winner === null ? 'DRAW' : hud.winner === selected ? 'YOU WIN!' : english ? 'YOU LOSE!' : 'คุณแพ้'}</p><p className="mt-1 text-xs text-gray-300">{hud.reason === 'xtreme' ? 'XTREME FINISH' : hud.reason === 'over' ? 'OVER FINISH' : 'SPIN FINISH'} · {hud.hits} {english ? 'collisions' : 'ครั้งที่ชน'}</p></div>}
                {isPaused && active && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 text-xl font-black">{english ? 'PAUSED' : 'พักเกม'}</div>}
                {hud.skill && <div className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-lg font-black italic text-yellow-300">XTREME DASH!</div>}
            </div>
            <div className="space-y-3 px-4 pb-5">
                <p className="text-center text-[10px] font-bold tracking-wide"><span className="text-amber-300">OVER ZONE · {english ? 'FRONT LEFT / RIGHT' : 'ล่างซ้าย / ล่างขวา'}</span><span className="mx-3 text-pink-400">XTREME ZONE · {english ? 'FRONT CENTER' : 'กลางด้านหน้า'}</span></p>
                {hud.phase === 'countdown' && <div><div className="relative h-3 overflow-hidden rounded-full bg-white/10"><div className="absolute inset-y-0 left-[76.3%] w-[5.3%] bg-primary/60" /><div className="absolute inset-y-0 w-1 bg-white" style={{ left: `${Math.min(99, hud.progress)}%` }} /></div><p className="mt-1 text-center text-[11px] text-gray-300">{english ? 'Press SHOOT on GO! White marker inside green = perfect.' : 'กด SHOOT ตอน GO! ขีดขาวเข้าแถบเขียว = จังหวะดีที่สุด'}</p></div>}
                {hud.phase === 'battle' && <p className="text-center text-xs font-bold text-primary">{qualityLabel} · {english ? 'Launch power' : 'พลังปล่อย'} {Math.round(45 + 55 * Math.max(0, hud.quality))}% · {hud.hits} HITS</p>}
                <div className="flex flex-wrap justify-center gap-2">
                    {!active && <button type="button" disabled={!ready || failed || !models.every(Boolean)} onClick={start} className={`${button} !border-primary !bg-primary !text-black`}><Swords size={15} />{hud.phase === 'finished' ? (english ? 'Play again' : 'เล่นอีกครั้ง') : (english ? 'Start mini game' : 'เริ่มมินิเกม')}</button>}
                    {hud.phase === 'countdown' && <button type="button" disabled={isPaused || hud.quality >= 0} onClick={launch} className={`${button} min-w-40 !border-primary !bg-primary !text-black`}><Zap size={15} />{hud.quality >= 0 ? qualityLabel : 'GO SHOOT! / Space'}</button>}
                    {hud.phase === 'battle' && <button type="button" disabled={isPaused || hud.charge < 100 || hud.skill} className={`${button} !border-yellow-400/40 !text-yellow-300`} onClick={() => { game.current.special(); refresh(); }}><Zap size={15} />{english ? 'Special' : 'ไม้ตาย'} · Xtreme Dash {hud.charge}% · E</button>}
                    {active && <button type="button" className={button} onClick={() => { paused.current = !paused.current; setPaused(paused.current); refresh(); }}>{isPaused ? <Play size={14} /> : <Pause size={14} />}{isPaused ? (english ? 'Resume' : 'เล่นต่อ') : (english ? 'Pause' : 'หยุดพัก')}</button>}
                    <button type="button" disabled={!ready} className={button} onClick={() => { game.current.reset(selected); paused.current = false; setPaused(false); refresh(); }}><RotateCcw size={14} />{english ? 'Reset' : 'เริ่มใหม่'}</button>
                </div>
                <p className="text-center text-[11px] leading-relaxed text-gray-400">{english ? 'Drag or use WASD / arrows. Four hits charge E: ride the gear line to the single yellow dash point. Only a strong dash impact can knock a top into Over / Xtreme pockets. A stopped top loses by Spin Finish.' : 'ลากหรือใช้ WASD / ลูกศร · ชน 4 ครั้งแล้วกด E ไต่รางไปแดชที่จุดสีเหลืองจุดเดียว · ต้องโดนแดชชนแรงจึงกระเด็นตก Over / Xtreme Zone ได้ · หมดแรงหมุนจะล้มและแพ้ Spin Finish'}</p>
                <p role="status" className={`text-center text-[10px] ${models.every(Boolean) ? 'text-primary/70' : 'text-amber-200/70'}`}>{models.every(Boolean) ? (english ? 'Original Sketchfab models loaded' : 'โหลดโมเดล Sketchfab แล้ว') : modelError ? (english ? 'Could not load the models. Please refresh to retry.' : 'โหลดโมเดลไม่สำเร็จ กรุณารีเฟรชเพื่อลองอีกครั้ง') : (english ? 'Loading your 3D Beyblades…' : 'กำลังโหลดลูกข่าง 3D…')}</p>
                <details className="text-center text-[10px] text-gray-500"><summary className="cursor-pointer">{english ? 'Model credits' : 'เครดิตโมเดลที่เลือก'}</summary><p className="mt-2">Toys, Games &amp; hobbies (@tgh14) · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer" className="underline">CC BY-NC-SA 4.0</a></p><div className="mt-1 flex justify-center gap-3">{blades.map(blade => <a key={blade.name} href={blade.source} target="_blank" rel="noreferrer" className="underline">{blade.name}</a>)}</div></details>
            </div>
        </section>
    );
}
