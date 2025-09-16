import { handleGeminiInteraction } from './geminiHandler.js';

let lastPot;

chrome.webRequest.onBeforeRequest.addListener(
    details => {
        if (details.type === 'xmlhttprequest' || details.type === 'fetch') {
            const url = new URL(details.url);
            const pot = url.searchParams.get('pot');
            const fromExt = url.searchParams.get('fromExt');
            if (!fromExt) {
                lastPot = pot;
            }
        }
    },
    {
        urls: ["https://www.youtube.com/api/timedtext?*"]
    }
);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPot') {
        sendResponse({ pot: lastPot });
        return true;
    } else if (request.action === 'sendToGeminiWeb') {
        // Get the processed content and send it to Gemini web interface
        getAndProcessSubsForGemini(request.track, request.tabId)
            .then(content => {
                if (content) {
                    sendContentToGeminiTab(content);
                }
            })
            .catch(error => console.error('Error processing for Gemini:', error));
        return true;
    }
});

// Function to process subtitles and return content
async function getAndProcessSubsForGemini(track, tabId) {
    if (!lastPot) {
        chrome.tabs.sendMessage(tabId, { action: 'showAlert', message: 'Please enable subtitles and refresh the page' });
        return null;
    }
    try {
        const response = await fetch(`${track.baseUrl}&fromExt=true&c=WEB&pot=${lastPot}`);
        const xml = await response.text();
        
        // Process the subtitles (using the same functions from content script)
        const singleLongParagraph = xmlToSingleParagraph(xml);
        const formattedParagraphs = breakIntoParagraphsRandomly(singleLongParagraph);
        const finalContent = addFrontmatterAndFooter(formattedParagraphs);
        
        return finalContent;
    } catch (error) {
        console.error('Error fetching or processing subtitles:', error);
        return null;
    }
}

// Function to send content to Gemini web interface
async function sendContentToGeminiTab(content) {
    try {
        const tab = await chrome.tabs.create({ url: "https://gemini.google.com/app" });
        
        const exec = async (fn, ...args) => 
            (await chrome.scripting.executeScript({ 
                target: { tabId: tab.id }, 
                func: fn, 
                args 
            }))?.[0]?.result;
            
        const exists = sel => exec(s => !!document.querySelector(s), sel);
        
        const wait = async (sel, max = 30) => {
            for (let i = 0; i < max; i++) {
                if (await exists(sel)) return true;
                await new Promise(r => setTimeout(r, 300));
            }
            return false;
        };
        
        const click = sel => exec(s => {
            const el = document.querySelector(s);
            el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }, sel);

        // Wait for page to load
        await Promise.all([wait("bard-mode-switcher"), wait("input-area-v2")]);

        // Try to switch to Flash mode if available
        await click("bard-mode-switcher button");
        for (let i = 0; i < 10; i++) {
            if (await exists(".cdk-overlay-container")) break;
            await new Promise(r => setTimeout(r, 300));
        }

        if (await exists(".cdk-overlay-container")) {
            for (let i = 0; i < 15; i++) {
                if (await exists(".cdk-overlay-pane")) {
                    await exec(() => {
                        const findFlash = () => new Promise(res => {
                            const check = () => {
                                const pane = document.querySelector(".cdk-overlay-pane");
                                if (!pane) return;
                                const flash = [...pane.querySelectorAll("button")].find(b => b.innerText.includes("Flash"));
                                flash ? res(flash) : setTimeout(check, 300);
                            };
                            check();
                        });
                        findFlash().then(btn => {
                            btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                            setTimeout(() => {
                                if (document.querySelector(".cdk-overlay-pane")) {
                                    const closeBtn = document.querySelector("bard-mode-switcher button");
                                    closeBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                                }
                            }, 500);
                        });
                    });
                    break;
                }
                await new Promise(r => setTimeout(r, 300));
            }
        }

        // Wait for textbox and insert content
        await wait('input-area-v2 rich-textarea [role="textbox"]', 25);
        await exec((textToInsert) => {
            const tb = document.querySelector('input-area-v2 rich-textarea [role="textbox"]');
            if (!tb) return;
            tb.focus();
            tb.innerText = textToInsert;
            tb.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        }, content);

        // Send the message
        for (let att = 0; att < 10; att++) {
            const isEmpty = await exec(() => {
                const tb = document.querySelector('input-area-v2 rich-textarea [role="textbox"]');
                const empty = tb ? tb.innerText.trim() === '' : true;
                return empty;
            });
            
            if (isEmpty) break;
            
            if (await exists('input-area-v2 button[aria-label="Send message"]')) {
                await click('input-area-v2 button[aria-label="Send message"]');
            } else {
                await exec(() => {
                    const tb = document.querySelector('input-area-v2 rich-textarea [role="textbox"]');
                    if (!tb) return;
                    tb.dispatchEvent(new KeyboardEvent('keydown', { 
                        key: 'Enter', 
                        code: 'Enter', 
                        keyCode: 13, 
                        which: 13, 
                        bubbles: true, 
                        cancelable: true 
                    }));
                });
            }
            
            if (att < 9) await new Promise(r => setTimeout(r, 300));
        }
    } catch (e) {
        console.error("Error in Gemini interaction:", e);
    }
}

// Helper functions (copied from content script)
function xmlToSingleParagraph(xml) {
    const characters = ['Q', 'Z', 'P', 'H', 'W', 'D', 'N', 'K', 'T', 'G', 'B', 'Y', 'V', 'S', 'U', 'R', 'J', 'E', 'O', 'M', 'C', 'L', 'X', 'A', 'F', 'I'];
    const utterances = new DOMParser().parseFromString(xml, 'text/xml').getElementsByTagName('text');
    let result = "";
    let markerCount = 0;
    Array.from(utterances).forEach((el, index) => {
        const text = (el.textContent || '').replace(/[\r\n]+/g, ' ').trim();
        if (!text) return;

        if (index % 5 === 0) {
            const charToInsert = characters[markerCount % characters.length];
            result += `(${charToInsert}) `;
            markerCount++;
        }

        result += text + " ";
    });
    return result.trim();
}

function breakIntoParagraphsRandomly(text, minLength = 250, maxLength = 550) {
    if (!text || typeof text !== 'string') return "";

    const punctuation = 
        '.?!;' + 
        '。？！；' + 
        '…' + 
        '။॥' + 
        '។';
    
    let remainingText = text.replace(/\s\s+/g, ' ').trim();
    const finalParagraphs = [];

    while (remainingText.length > 0) {
        if (remainingText.length <= maxLength) {
            finalParagraphs.push(remainingText);
            break;
        }

        const randomTargetLength = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
        
        let breakIndex = -1;
        let fallbackSpaceIndex = -1;
        let fallbackPunctuationIndex = -1;

        for (let i = Math.min(randomTargetLength, remainingText.length -1) ; i >= minLength; i--) {
            if (remainingText[i] === ' ' && punctuation.includes(remainingText[i - 1])) {
                if (isBreakPointValid(remainingText, i)) {
                    breakIndex = i;
                    break; 
                }
            }
            
            if (fallbackSpaceIndex === -1 && remainingText[i] === ' ') {
                if (isBreakPointValid(remainingText, i)) {
                    fallbackSpaceIndex = i;
                }
            }

            if (fallbackPunctuationIndex === -1 && punctuation.includes(remainingText[i])) {
                if (isBreakPointValid(remainingText, i + 1)) {
                    fallbackPunctuationIndex = i + 1; 
                }
            }
        }

        if (breakIndex !== -1) {
        } else if (fallbackSpaceIndex !== -1) {
            breakIndex = fallbackSpaceIndex;
        } else if (fallbackPunctuationIndex !== -1) {
            breakIndex = fallbackPunctuationIndex;
        } else {
            breakIndex = randomTargetLength;
        }

        const newPara = remainingText.substring(0, breakIndex).trim();
        finalParagraphs.push(newPara);
        remainingText = remainingText.substring(breakIndex).trim();
    }

    return finalParagraphs.join('\n\n');
}

function isBreakPointValid(text, index) {
    const textBefore = text.substring(0, index).trim();
    const textAfter = text.substring(index).trim();
    const isPrecededByMarker = textBefore.match(/\([A-Z]\)$/);
    const isSucceededByMarker = textAfter.match(/^\([A-Z]\)/);
    return !isPrecededByMarker && !isSucceededByMarker;
}

function addFrontmatterAndFooter(bodyContent) {
    const frontmatter = `Translate into Vietnamese\n\n\`\`\`\n---
title: My Third Blog Post
author: Astro Learner
description: "I had some challenges, but asking in the community really helped!"
image:
    url: "https://docs.astro.build/assets/rays.webp  "
    alt: "The Astro logo on a dark background with rainbow rays."
pubDate: 2022-07-15
tags: ["astro", "learning in public", "setbacks", "community"]
---\n`;

    const footer = `\n---
Let's keep in touch to stay up to date with the latest updates from Astro. https://github.com/withastro/astro  \n\`\`\``;
    return `${frontmatter}\n${bodyContent}\n${footer}`;
}