import { useEffect, useState } from 'react';

export function useRealtimeEvents({
    enabled = true,
    token = '',
    domains = ['service_orders'],
    onEvent,
} = {}) {
    // Realtime socket is intentionally disabled in the Laravel-Inertia frontend
    // to keep this app decoupled from backend runtime dependencies.
    const [status, setStatus] = useState('disabled');

    useEffect(() => {
        setStatus(enabled ? 'disabled' : 'off');
    }, [enabled, token, domains, onEvent]);

    return { status };
}
