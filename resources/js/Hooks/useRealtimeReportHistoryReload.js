import { useCallback, useEffect, useRef } from 'react';
import { router } from '@inertiajs/react';
import { useRealtimeEvents } from '@/Hooks/useRealtimeEvents';

const DEFAULT_SUBSCRIPTIONS = [
    { channel: 'workshop.serviceorders', events: ['serviceorder.created', 'serviceorder.updated', 'serviceorder.deleted'] },
    { channel: 'workshop.partpurchases', events: ['partpurchase.created', 'partpurchase.updated'] },
    { channel: 'workshop.partsales', events: ['partsale.created'] },
    { channel: 'workshop.parts', events: ['part.created', 'part.updated', 'part.deleted'] },
    { channel: 'workshop.partpurchaseorders', events: ['partpurchaseorder.created', 'partpurchaseorder.deleted'] },
    { channel: 'workshop.partsalesorders', events: ['partsalesorder.created', 'partsalesorder.deleted'] },
    { channel: 'workshop.mechanics', events: ['mechanic.created', 'mechanic.updated', 'mechanic.deleted'] },
    { channel: 'workshop.products', events: ['product.created', 'product.updated', 'product.deleted'] },
];

const CHANNEL_DOMAIN_MAP = {
    'workshop.serviceorders': 'service_orders',
    'workshop.partpurchases': 'part_purchases',
    'workshop.partsales': 'part_sales',
    'workshop.parts': 'parts',
    'workshop.partpurchaseorders': 'part_purchase_orders',
    'workshop.partsalesorders': 'part_sales_orders',
    'workshop.mechanics': 'mechanics',
    'workshop.products': 'products',
};

const normalizeDomains = (subscriptions) => {
    if (!Array.isArray(subscriptions)) return [];
    const domains = subscriptions
        .map((subscription) => {
            if (typeof subscription === 'string') return subscription;
            if (!subscription?.channel) return null;
            return CHANNEL_DOMAIN_MAP[subscription.channel] || null;
        })
        .filter(Boolean);
    return Array.from(new Set(domains));
};

export function useRealtimeReportHistoryReload({
    enabled = true,
    debounceMs = 800,
    subscriptions = DEFAULT_SUBSCRIPTIONS,
    only = [],
    preserveScroll = true,
    preserveState = true,
} = {}) {
    const debounceTimerRef = useRef(null);
    const domains = normalizeDomains(subscriptions);

    const scheduleReload = useCallback(() => {
        if (!enabled) return;

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            router.reload({
                only: only.length > 0 ? only : undefined,
                preserveScroll,
                preserveState,
            });
        }, debounceMs);
    }, [enabled, debounceMs, only, preserveScroll, preserveState]);

    useRealtimeEvents({
        enabled: enabled && domains.length > 0,
        domains,
        onEvent: () => {
            scheduleReload();
        },
    });

    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);
}

