// content.js - Main entry point for content script

import { createUI, getSubs, check, sendToAI } from './uiManager.js';

let url = '';
const pollCheck = () => {
    if (location.href === url) return;
    url = location.href;
    const videoId = new URL(location.href).searchParams.get('v');
    videoId ? getSubs(videoId) : document.querySelector('#captionDownloadContainer')?.remove();
};

setInterval(pollCheck, 500);
pollCheck();