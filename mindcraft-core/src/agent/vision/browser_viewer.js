import settings from '../settings.js';

export function addBrowserViewer(bot, count_id) {
    if (settings.render_bot_view) {
        console.warn('Browser viewer is currently disabled because "prismarine-viewer" was removed to ensure a successful install on Windows.');
    }
}