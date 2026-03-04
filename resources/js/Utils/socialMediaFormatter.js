/**
 * Format social media handles to full URLs for display
 */

/**
 * Normalize Instagram handle to full URL
 * @param {string} handle - Instagram handle (with or without @)
 * @returns {string} Full Instagram URL
 */
export const formatInstagram = (handle) => {
    if (!handle) return '';

    // If already a full URL, return as is
    if (handle.startsWith('http://') || handle.startsWith('https://')) {
        return handle;
    }

    // Remove @ if present
    const cleanHandle = handle.replace(/^@/, '').trim();

    return `instagram.com/${cleanHandle}`;
};

/**
 * Normalize Facebook handle to full URL
 * @param {string} handle - Facebook username or page
 * @returns {string} Full Facebook URL
 */
export const formatFacebook = (handle) => {
    if (!handle) return '';

    // If already a full URL, return as is
    if (handle.startsWith('http://') || handle.startsWith('https://')) {
        return handle;
    }

    // Remove @ if present
    const cleanHandle = handle.replace(/^@/, '').trim();

    return `facebook.com/${cleanHandle}`;
};

/**
 * Normalize TikTok handle to full URL
 * @param {string} handle - TikTok username (with or without @)
 * @returns {string} Full TikTok URL
 */
export const formatTikTok = (handle) => {
    if (!handle) return '';

    // If already a full URL, return as is
    if (handle.startsWith('http://') || handle.startsWith('https://')) {
        return handle;
    }

    // Remove @ if present
    const cleanHandle = handle.replace(/^@/, '').trim();

    return `tiktok.com/@${cleanHandle}`;
};

/**
 * Normalize website URL
 * @param {string} url - Website URL
 * @returns {string} Normalized website URL
 */
export const formatWebsite = (url) => {
    if (!url) return '';

    const trimmedUrl = url.trim();

    // If already has protocol, return as is
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
        return trimmedUrl.replace(/^https?:\/\//, ''); // Remove protocol for cleaner print
    }

    return trimmedUrl;
};

/**
 * Format Google My Business
 * @param {string} name - Business name or URL
 * @returns {string} Formatted display text
 */
export const formatGoogleMyBusiness = (name) => {
    if (!name) return '';

    // If it's a URL, extract the business name or return simplified
    if (name.startsWith('http://') || name.startsWith('https://')) {
        return name.replace(/^https?:\/\//, ''); // Remove protocol
    }

    return name;
};

/**
 * Format all social media fields for display
 * @param {Object} businessProfile - Business profile object
 * @returns {Array} Array of formatted social media items
 */
export const formatBusinessSocials = (businessProfile) => {
    const socials = [];

    if (businessProfile?.facebook) {
        socials.push({
            label: 'FB',
            value: formatFacebook(businessProfile.facebook),
            icon: '📘'
        });
    }

    if (businessProfile?.instagram) {
        socials.push({
            label: 'IG',
            value: formatInstagram(businessProfile.instagram),
            icon: '📷'
        });
    }

    if (businessProfile?.tiktok) {
        socials.push({
            label: 'TikTok',
            value: formatTikTok(businessProfile.tiktok),
            icon: '🎵'
        });
    }

    if (businessProfile?.website) {
        socials.push({
            label: 'Web',
            value: formatWebsite(businessProfile.website),
            icon: '🌐'
        });
    }

    if (businessProfile?.google_my_business) {
        socials.push({
            label: 'Google',
            value: formatGoogleMyBusiness(businessProfile.google_my_business),
            icon: '📍'
        });
    }

    return socials;
};

const parseSocialHandle = (value, platform) => {
    if (!value) return '';

    let normalized = String(value).trim().toLowerCase();
    normalized = normalized.replace(/^https?:\/\//, '').replace(/^www\./, '');

    if (platform === 'facebook') {
        normalized = normalized.replace(/^facebook\.com\//, '');
    }
    if (platform === 'instagram') {
        normalized = normalized.replace(/^instagram\.com\//, '');
    }
    if (platform === 'tiktok') {
        normalized = normalized.replace(/^tiktok\.com\//, '').replace(/^@/, '');
    }

    normalized = normalized.split('?')[0].split('#')[0].replace(/^@/, '').replace(/\/+$/, '');

    if (normalized.includes('/')) {
        normalized = normalized.split('/')[0];
    }

    return normalized;
};

/**
 * Build compact social display for print headers.
 * If FB/IG/TikTok share same username, merge into one line.
 * @param {Object} businessProfile
 * @returns {{ mergedLine: string|null, socials: Array }}
 */
export const getCompactBusinessSocialDisplay = (businessProfile) => {
    const socials = formatBusinessSocials(businessProfile);

    const channels = [
        { label: 'FB', handle: parseSocialHandle(businessProfile?.facebook, 'facebook') },
        { label: 'IG', handle: parseSocialHandle(businessProfile?.instagram, 'instagram') },
        { label: 'TikTok', handle: parseSocialHandle(businessProfile?.tiktok, 'tiktok') },
    ].filter((item) => item.handle);

    if (channels.length < 2) {
        return { mergedLine: null, socials };
    }

    const uniqueHandles = [...new Set(channels.map((item) => item.handle))];
    if (uniqueHandles.length !== 1) {
        return { mergedLine: null, socials };
    }

    const username = uniqueHandles[0];
    const platforms = channels.map((item) => item.label).join('/');
    const mergedLine = `📱 @${username} (${platforms})`;
    const filteredSocials = socials.filter((item) => !['FB', 'IG', 'TikTok'].includes(item.label));

    return { mergedLine, socials: filteredSocials };
};

/**
 * Resolve Google Business URL from profile field.
 * @param {string} value
 * @returns {string}
 */
export const resolveGoogleBusinessUrl = (value) => {
    if (!value) return '';

    const trimmed = String(value).trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }

    const urlLike = /^([\w-]+\.)+[\w-]+(\/.*)?$/i.test(trimmed);
    if (urlLike) {
        return `https://${trimmed}`;
    }

    return '';
};

/**
 * Build QR image URL from Google Business link.
 * @param {string} value
 * @param {number} size
 * @returns {string}
 */
export const getGoogleBusinessQrUrl = (value, size = 120) => {
    const googleBusinessUrl = resolveGoogleBusinessUrl(value);
    if (!googleBusinessUrl) return '';

    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(googleBusinessUrl)}`;
};
