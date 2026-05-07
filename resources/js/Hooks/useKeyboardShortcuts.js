import { useEffect } from 'react';
import { router } from '@inertiajs/react';
import { flattenSidebarItems, getComparableSidebarHref } from '@/Utils/sidebarShortcuts';

export function useKeyboardShortcuts(menuItems) {
    useEffect(() => {
        const shortcutItems = flattenSidebarItems(menuItems);

        const handleKeyDown = (e) => {
            if (!e.altKey) return;

            if (e.key === 's' || e.key === 'S') {
                e.preventDefault();
                const searchInput = document.querySelector('[data-keyboard-search]');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            }

            if (e.key === 't' || e.key === 'T') {
                e.preventDefault();
                const toggleBtn = document.querySelector('[data-toggle-sidebar]');
                if (toggleBtn) {
                    toggleBtn.click();
                }
            }

            const pressedNumber = Number.parseInt(e.key, 10);
            if (!Number.isInteger(pressedNumber) || pressedNumber < 1 || pressedNumber > 9) {
                return;
            }

            const item = shortcutItems[pressedNumber - 1];
            if (!item?.href) {
                return;
            }

            e.preventDefault();

            if (item.external) {
                window.location.href = item.href;
                return;
            }

            router.visit(getComparableSidebarHref(item.href), {
                preserveScroll: false,
                preserveState: false,
            });
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [menuItems]);
}

export function getShortcutKey(index) {
    return `Alt+${index}`;
}

export function getAvailableShortcuts(menuItems) {
    return flattenSidebarItems(menuItems).map((item, index) => ({
        key: `Alt+${index + 1}`,
        title: item.title,
        href: item.href,
    }));
}
