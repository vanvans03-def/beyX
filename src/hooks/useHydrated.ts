'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Keep SSR controls disabled until React has attached their event handlers. */
export function useHydrated(): boolean {
    return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
