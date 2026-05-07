export const isExternalSidebarHref = (href) => {
    const value = String(href || "");

    if (!value) return false;
    if (value.startsWith("/api-docs/")) return true;
    if (/^(mailto:|tel:)/i.test(value)) return true;

    try {
        const target = new URL(value, window.location.origin);
        return target.origin !== window.location.origin;
    } catch {
        return false;
    }
};

export const getComparableSidebarHref = (href) => {
    const value = String(href || "");

    if (!value || isExternalSidebarHref(value)) return value;

    try {
        const target = new URL(value, window.location.origin);
        return `${target.pathname}${target.search}${target.hash}`;
    } catch {
        return value;
    }
};

export const flattenSidebarItems = (menuItems = []) => {
    const items = [];

    menuItems.forEach((section) => {
        (section.details || []).forEach((detail) => {
            if (detail?.permissions === true && detail.href) {
                items.push({
                    href: detail.href,
                    title: detail.title,
                    icon: detail.icon,
                    section: section.title,
                    external: isExternalSidebarHref(detail.href),
                });
            }

            (detail.subdetails || []).forEach((subdetail) => {
                if (subdetail?.permissions === true && subdetail.href) {
                    items.push({
                        href: subdetail.href,
                        title: subdetail.title,
                        icon: subdetail.icon,
                        section: section.title,
                        external: isExternalSidebarHref(subdetail.href),
                    });
                }
            });
        });
    });

    return items;
};

export const getSidebarShortcutMap = (menuItems = []) => {
    const map = {};

    flattenSidebarItems(menuItems).forEach((item, index) => {
        map[item.href] = index + 1;
        map[getComparableSidebarHref(item.href)] = index + 1;
    });

    return map;
};
