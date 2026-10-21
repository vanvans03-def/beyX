import type * as Three from 'three';

// A fixed pool keeps repeated contacts from allocating GPU objects each frame.
export function createBeybladeImpacts(T: typeof Three, scene: Three.Scene, resources: Set<{ dispose: () => void }>, plane: 'xz' | 'xy', scale = 1) {
    const own = <U extends { dispose: () => void }>(value: U) => { resources.add(value); return value; };
    const ringGeometry = own(new T.RingGeometry(0.48 * scale, 0.54 * scale, 32));
    const sparkGeometry = own(new T.BoxGeometry(0.16 * scale, 0.035 * scale, 0.035 * scale));
    const pool = Array.from({ length: 5 }, () => {
        const group = new T.Group(); scene.add(group); group.visible = false;
        if (plane === 'xz') group.rotation.x = -Math.PI / 2;
        const rings = [0x68ceff, 0xff8cda].map(color => {
            const material = own(new T.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
            const mesh = new T.Mesh(ringGeometry, material); group.add(mesh); return mesh;
        });
        const sparkMaterial = own(new T.MeshBasicMaterial({ color: 0xffe9ac, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
        const sparks = Array.from({ length: 14 }, (_, i) => {
            const mesh = new T.Mesh(sparkGeometry, sparkMaterial); mesh.rotation.z = i / 14 * Math.PI * 2; group.add(mesh); return mesh;
        });
        return { group, rings, sparks, sparkMaterial, age: 1, power: 1 };
    });
    let cursor = 0;
    return {
        burst(x: number, y: number, power = 1) {
            const effect = pool[cursor++ % pool.length]; effect.age = 0; effect.power = power;
            effect.group.position.set(x, plane === 'xz' ? 0.3 : y, plane === 'xz' ? y : 90);
            effect.group.visible = true;
        },
        update(dt: number, reduced: boolean) {
            for (const effect of pool) {
                effect.age += dt;
                const life = Math.max(0, 1 - effect.age / 0.42);
                effect.group.visible = life > 0;
                effect.rings.forEach((ring, i) => {
                    ring.scale.setScalar(reduced ? 1 : 0.7 + effect.age * (4 + i * 2) * effect.power);
                    ring.position.x = (i ? 1 : -1) * scale * 0.22;
                    ring.material.opacity = life * 0.85;
                });
                effect.sparkMaterial.opacity = reduced ? 0 : life;
                effect.sparks.forEach((spark, i) => {
                    const angle = i / effect.sparks.length * Math.PI * 2;
                    const radius = (0.15 + effect.age * (2 + i % 3)) * scale * effect.power;
                    spark.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
                    spark.scale.x = 0.5 + life * 2;
                });
            }
        },
        get active() { return pool.some(effect => effect.age < 0.42); },
        clear() { pool.forEach(effect => { effect.age = 1; effect.group.visible = false; }); },
    };
}
