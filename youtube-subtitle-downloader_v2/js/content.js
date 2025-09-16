const createUI = tracks => {
    $('#captionDownloadContainer')?.remove();
    const div = Object.assign(document.createElement('div'), {
        id: 'captionDownloadContainer',
        style: 'padding:10px 5px 10px 0;margin:10px 0;font-size:15px'
    });
    if (!tracks?.length) {
        div.textContent = 'No subtitles found';
    } else {
        div.append('Actions: ');
        tracks.forEach(track => {
            // Create container for both buttons
            const buttonContainer = Object.assign(document.createElement('span'), {
                style: 'display: inline-block; margin-left: 10px;'
            });
            
            // Process & Send to AI button (API version)
            const aiButton = Object.assign(document.createElement('a'), {
                textContent: `[Process & Send ${getLabel(track)} to AI]`,
                title: 'Send formatted text to the AI for processing',
                href: '#',
                style: 'margin-right: 8px; cursor:pointer; color:mediumpurple; font-weight:bold; text-decoration:underline',
                onclick: async (event) => { 
                    event.preventDefault();
                    const content = await getAndProcessSubs(track);
                    if(content) sendToAI(content);
                }
            });
            
            // Send by Open Web button (Gemini web interface version)
            const openWebButton = Object.assign(document.createElement('a'), {
                textContent: `[Send by Open Web]`,
                title: 'Open Gemini and send content automatically',
                href: '#',
                style: 'cursor:pointer; color:#4285F4; font-weight:bold; text-decoration:underline',
                onclick: async (event) => {
                    event.preventDefault();
                    // Send message to background script to handle Gemini interaction
                    chrome.runtime.sendMessage({
                        action: 'sendToGeminiWeb',
                        track: track
                    });
                }
            });
            
            buttonContainer.appendChild(aiButton);
            buttonContainer.appendChild(openWebButton);
            div.appendChild(buttonContainer);
        });
    }
    const target = $('#bottom-row') || $('#meta #meta-contents #container #top-row');
    target?.parentNode?.insertBefore(div, target);
};