export type PlaygroundBody = { x: number; y: number; vx: number; vy: number; held: boolean; returnAfter: number };
export const PLAYGROUND_RADIUS = 36;

export function bounceAtEdges(body: PlaygroundBody, width: number, height: number) {
    const margin = PLAYGROUND_RADIUS + 8;
    const right = Math.max(margin, width - margin), bottom = Math.max(margin, height - margin);
    if (body.x <= margin) { body.x = margin; if (body.vx < 0) body.vx *= -0.82; }
    if (body.x >= right) { body.x = right; if (body.vx > 0) body.vx *= -0.82; }
    if (body.y <= margin) { body.y = margin; if (body.vy < 0) body.vy *= -0.82; }
    if (body.y >= bottom) { body.y = bottom; if (body.vy > 0) body.vy *= -0.82; }
}

export function collidePlaygroundBodies(a: PlaygroundBody, b: PlaygroundBody, time: number) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const distance = Math.hypot(dx, dy), diameter = PLAYGROUND_RADIUS * 2;
    if (distance >= diameter || (a.held && b.held)) return false;
    const nx = distance > 0.001 ? dx / distance : 1, ny = distance > 0.001 ? dy / distance : 0;
    const inverseA = a.held ? 0 : 1, inverseB = b.held ? 0 : 1;
    const total = inverseA + inverseB;
    const overlap = diameter - distance + 0.1;
    a.x -= nx * overlap * inverseA / total; a.y -= ny * overlap * inverseA / total;
    b.x += nx * overlap * inverseB / total; b.y += ny * overlap * inverseB / total;
    const closingSpeed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (closingSpeed < 0) {
        const impulse = -(1 + 0.85) * closingSpeed / total;
        a.vx -= impulse * nx * inverseA; a.vy -= impulse * ny * inverseA;
        b.vx += impulse * nx * inverseB; b.vy += impulse * ny * inverseB;
    }
    a.returnAfter = b.returnAfter = time + 4;
    return true;
}

export function advancePlaygroundBody(body: PlaygroundBody, dt: number, width: number, height: number) {
    if (!body.held) {
        body.x += body.vx * dt; body.y += body.vy * dt;
        const damping = Math.exp(-0.8 * dt);
        body.vx *= damping; body.vy *= damping;
    }
    bounceAtEdges(body, width, height);
}
