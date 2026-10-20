import { test, expect, generate } from './support/fixture';

test('score commit broadcasts to an independent public browser over SSE', async ({ lab, page }) => {
    const id = await lab.tournament(); await lab.players(id, 4); await generate(lab, id);
    await page.goto('/');
    await page.evaluate(id => {
        const state = window as unknown as { e2eReady: boolean; e2eMessages: { matches?: { id: string; winner_id: string }[] }[]; e2eEvents: EventSource };
        state.e2eReady = false; state.e2eMessages = [];
        state.e2eEvents = new EventSource(`/api/realtime/tournaments/${id}`);
        state.e2eEvents.addEventListener('ready', () => { state.e2eReady = true; });
        state.e2eEvents.addEventListener('tournament-update', event => state.e2eMessages.push(JSON.parse((event as MessageEvent).data)));
    }, id);
    try {
        await expect.poll(() => page.evaluate(() => (window as unknown as { e2eReady: boolean }).e2eReady)).toBe(true);
        const match = (await lab.matches(id)).find(m => m.state === 'OPEN')!;
        await lab.score(id, match);
        await expect.poll(() => page.evaluate(({ id, winner }) => (window as unknown as { e2eMessages: { matches?: { id: string; winner_id: string }[] }[] }).e2eMessages.some(message => message.matches?.some(m => m.id === id && m.winner_id === winner)), { id: match.id, winner: match.player1_id })).toBe(true);
    } finally { await page.evaluate(() => (window as unknown as { e2eEvents: EventSource }).e2eEvents.close()); }
});
