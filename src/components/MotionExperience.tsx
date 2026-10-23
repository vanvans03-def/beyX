'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** Progressive enhancement only: no routing, input handling, or hidden SSR content. */
export function MotionExperience() {
    const pathname = usePathname();

    useEffect(() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
        let disposed = false;
        let generation = 0;
        let cleanup = () => {};

        const start = async () => {
            const current = ++generation;
            cleanup();
            cleanup = () => {};
            if (disposed || reduced.matches) return;
            try {
                const { gsap } = await import('gsap');
                if (disposed || reduced.matches || generation !== current) return;
                const seen = new WeakSet<Element>();
                const context = gsap.context(() => {});
                let pendingFrame = 0;
                const reveal = (element: Element) => {
                    if (!(element instanceof HTMLElement) || seen.has(element)) return;
                    seen.add(element);
                    // Never transform a page/form container: it can change fixed dialogs,
                    // drag coordinates, sticky positioning, and dropdown containing blocks.
                    context.add(() => {
                        gsap.fromTo(element, { opacity: 0.2, y: 22 }, {
                            opacity: 1, y: 0, duration: 0.65, ease: 'power3.out',
                            clearProps: 'opacity,transform', overwrite: 'auto',
                        });
                    });
                };
                const observer = new IntersectionObserver(entries => {
                    for (const entry of entries) if (entry.isIntersecting) {
                        observer.unobserve(entry.target);
                        reveal(entry.target);
                    }
                }, { threshold: 0.08 });
                const scan = () => {
                    pendingFrame = 0;
                    const entrance = Array.from(document.querySelectorAll<HTMLElement>('[data-motion="home"], [data-motion="enter"]')).filter(element => !seen.has(element));
                    if (entrance.length) {
                        entrance.forEach(element => seen.add(element));
                        context.add(() => {
                            const timeline = gsap.timeline();
                            // Inputs and auth copy stay readable throughout the entrance.
                            // Only the decorative homepage sequence fades from transparent.
                            timeline.fromTo(entrance, { opacity: (_index: number, element: HTMLElement) => element.dataset.motion === 'home' ? 0 : 1, y: 32, scale: 0.97 }, {
                                opacity: 1, y: 0, scale: 1, duration: 0.8, stagger: 0.09, delay: 0.1,
                                ease: 'power3.out', clearProps: 'opacity,transform', overwrite: 'auto',
                            });
                        });
                    }
                    document.querySelectorAll<HTMLElement>('[data-motion="feedback"]').forEach(element => {
                        if (seen.has(element)) return;
                        seen.add(element);
                        context.add(() => { gsap.fromTo(element, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out', clearProps: 'opacity,transform' }); });
                    });
                    document.querySelectorAll('[data-motion="reveal"]').forEach(element => {
                        if (!seen.has(element)) observer.observe(element);
                    });
                };
                const changes = new MutationObserver(() => {
                    if (!pendingFrame) pendingFrame = requestAnimationFrame(scan);
                });
                changes.observe(document.body, { childList: true, subtree: true });
                scan();
                // Pointer glow is local to decorative surfaces; no ticker or touch listeners.
                const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
                let surface: HTMLElement | null = null;
                let glowFrame = 0;
                let x = 0, y = 0;
                const move = (event: PointerEvent) => {
                    if (!pointer.matches || event.pointerType === 'touch') return;
                    const next = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-motion-surface]') : null;
                    if (surface !== next) surface?.removeAttribute('data-motion-hover');
                    surface = next;
                    if (!surface) return;
                    x = event.clientX; y = event.clientY;
                    if (!glowFrame) glowFrame = requestAnimationFrame(() => {
                        glowFrame = 0;
                        if (!surface?.isConnected) return;
                        const bounds = surface.getBoundingClientRect();
                        surface.style.setProperty('--spot-x', `${x - bounds.left}px`);
                        surface.style.setProperty('--spot-y', `${y - bounds.top}px`);
                        surface.setAttribute('data-motion-hover', 'true');
                    });
                };
                const leave = () => { surface?.removeAttribute('data-motion-hover'); surface = null; };
                document.addEventListener('pointermove', move, { passive: true });
                document.addEventListener('pointerleave', leave);
                window.addEventListener('blur', leave);
                cleanup = () => {
                    observer.disconnect(); changes.disconnect();
                    cancelAnimationFrame(pendingFrame); cancelAnimationFrame(glowFrame);
                    document.removeEventListener('pointermove', move);
                    document.removeEventListener('pointerleave', leave);
                    window.removeEventListener('blur', leave);
                    leave(); context.revert();
                };
            } catch {
                // Animation download/initialization failure must never block the application.
            }
        };
        void start();
        reduced.addEventListener('change', start);
        return () => { disposed = true; reduced.removeEventListener('change', start); cleanup(); };
    }, [pathname]);

    return null;
}
