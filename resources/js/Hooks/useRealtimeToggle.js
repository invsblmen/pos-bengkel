import { useState, useEffect } from 'react';

const REALTIME_STORAGE_KEY = 'service-orders-realtime-enabled';

export function useRealtimeToggle() {
    const [realtimeEnabled, setRealtimeEnabled] = useState(() => {
        if (typeof window === 'undefined') return true;
        return window.localStorage.getItem(REALTIME_STORAGE_KEY) !== '0';
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(REALTIME_STORAGE_KEY, realtimeEnabled ? '1' : '0');
    }, [realtimeEnabled]);

    return [realtimeEnabled, setRealtimeEnabled];
}
