import { useEffect, useState } from 'react';

export function useReportRealtimeEvents({ enabled = true, debounceMs = 1000 } = {}) {
    // Realtime socket is intentionally disabled in Laravel-Inertia frontend
    // to keep this app decoupled from GO runtime dependencies.
    const [connectionStatus, setConnectionStatus] = useState('disabled');

    useEffect(() => {
        setConnectionStatus(enabled ? 'disabled' : 'off');
    }, [enabled, debounceMs]);

    return {
        connectionStatus,
        eventMeta: null,
        highlightSecondsLeft: 0,
        isHighlightActive: false,
    };
}
