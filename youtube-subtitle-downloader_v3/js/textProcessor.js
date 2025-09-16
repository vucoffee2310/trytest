// textProcessor.js - All text formatting and XML processing logic

export function breakIntoParagraphsRandomly(text, minLength = 250, maxLength = 550) {
  if (!text || typeof text !== 'string') return "";

  const punctuation =
      '.?!;' + '。？！；' + '…' + '။॥' + '។';

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

export function xmlToSingleParagraph(xml) {
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
};

function isBreakPointValid(text, index) {
  const textBefore = text.substring(0, index).trim();
  const textAfter = text.substring(index).trim();
  const isPrecededByMarker = textBefore.match(/\([A-Z]\)$/);
  const isSucceededByMarker = textAfter.match(/^\([A-Z]\)/);
  return !isPrecededByMarker && !isSucceededByMarker;
}

export function processSubtitles(xml) {
    const singleLongParagraph = xmlToSingleParagraph(xml);
    const formattedParagraphs = breakIntoParagraphsRandomly(singleLongParagraph);
    return formattedParagraphs;
}

export function addFrontmatterAndFooter(bodyContent) {
    const frontmatter = `Translate into Vietnamese\n\n\`\`\`\n---
title: My Third Blog Post
author: Astro Learner
description: "I had some challenges, but asking in the community really helped!"
image:
    url: "  https://docs.astro.build/assets/rays.webp  "
    alt: "The Astro logo on a dark background with rainbow rays."
pubDate: 2022-07-15
tags: ["astro", "learning in public", "setbacks", "community"]
---\n`;

    const footer = `\n---
Let's keep in touch to stay up to date with the latest updates from Astro. https://github.com/withastro/astro  \n\`\`\``;
    return `${frontmatter}\n${bodyContent}\n${footer}`;
}