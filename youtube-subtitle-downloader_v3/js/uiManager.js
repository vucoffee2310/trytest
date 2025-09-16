// uiManager.js - Handles YouTube page DOM manipulation and UI

import { processSubtitles, addFrontmatterAndFooter } from './textProcessor.js';

const $ = s => document.querySelector(s);
const getVideoId = () => new URL(location.href).searchParams.get('v');

export const getLabel = track => track?.name?.simpleText || track?.name?.runs?.map(r => r.text).join('') || track?.languageName?.simpleText || track?.languageCode || 'Unknown';

export const getAndProcessSubs = async (track) => {
    const { pot } = await new Promise(resolve => chrome.runtime.sendMessage({ action: 'getPot' }, resolve)) || {};
    if (!pot) {
        alert('Please enable subtitles and refresh the page');
        return null;
    }
    const xml = await fetch(`${track.baseUrl}&fromExt=true&c=WEB&pot=${pot}`).then(r => r.text());
    const bodyContent = processSubtitles(xml);
    return addFrontmatterAndFooter(bodyContent);
};

export const createUI = tracks => {
    $('#captionDownloadContainer')?.remove();
    const div = Object.assign(document.createElement('div'), {
        id: 'captionDownloadContainer',
        style: 'padding:10px 5px 10px 0;margin:10px 0;font-size:15px'
    });
    if (!tracks?.length) {
        div.textContent = 'No subtitles found';
    } else {
        div.append('Actions: ');

        div.append(Object.assign(document.createElement('a'), {
            textContent: `[Send by web]`,
            title: 'Open Gemini and auto-send a message',
            href: '#',
            style: 'margin-left:10px;cursor:pointer;color:blue;font-weight:bold;text-decoration:underline',
            onclick: async (event) => {
                event.preventDefault();
                if (tracks.length === 0) {
                    alert('No subtitle tracks available.');
                    return;
                }
                const firstTrack = tracks[0];
                const content = await getAndProcessSubs(firstTrack);
                if (!content) {
                    alert('Failed to get subtitle content.');
                    return;
                }
                chrome.runtime.sendMessage({ action: 'sendByWeb', content: content });
            }
        }));

        tracks.forEach(track => {
            div.append(Object.assign(document.createElement('a'), {
                textContent: `[Process & Send ${getLabel(track)} to AI]`,
                title: 'Send formatted text to the AI for processing',
                href: '#',
                style: 'margin-left:10px;cursor:pointer;color:mediumpurple;font-weight:bold;text-decoration:underline',
                onclick: async (event) => {
                    event.preventDefault();
                    const content = await getAndProcessSubs(track);
                    if(content) sendToAI(content);
                }
            }));
        });
    }
    const target = $('#bottom-row') || $('#meta #meta-contents #container #top-row');
    target?.parentNode?.insertBefore(div, target);
};

export const getSubs = async videoId => {
    try {
        const html = await fetch(`https://www.youtube.com/watch?v=${videoId}`).then(r => r.text());
        const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/s);
        const tracks = match ? JSON.parse(match[1])?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [] : [];
        createUI(tracks);
    } catch (e) {
        console.error(e);
        createUI([]);
    }
};

export const check = () => {
    const url = location.href;
    const videoId = getVideoId();
    videoId ? getSubs(videoId) : $('#captionDownloadContainer')?.remove();
};

// AI Sending Function (Keep it here since it's UI-triggered)
export const sendToAI = (content) => {
    const API_KEY = "AIzaSyAzddIKNOyH3qWYcdkAWNoKKobVzRa2RXQ";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash  :streamGenerateContent?alt=sse&key=${API_KEY}`;

    const payload = {
        contents: [{
            role: "user",
            parts: [{ text: content }]
        }],
        generationConfig: {
            temperature: 1.4,
            "thinkingConfig": {
                "thinkingBudget": 600,
            },
            topP: 0.6,
        }
    };

    console.log("Payload before sending to AI:");
    console.log(payload);

    console.log("Sending content to AI. Check console for streaming response...");
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        return response.body.getReader();
    })
    .then(reader => {
      const decoder = new TextDecoder();
      let leftover = "";

      function read() {
        reader.read().then(({ value, done }) => {
          if (done) return console.log("\n--- AI Stream Finished ---");

          const chunk = leftover + decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          leftover = lines.pop();

          for (let line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (textContent) {
                    console.log(textContent);
                }
              } catch (e) {
                // Ignore empty or malformed data chunks
              }
            }
          }
          read();
        });
      }
      read();
    })
    .catch(error => console.error('Error sending to AI:', error));
};