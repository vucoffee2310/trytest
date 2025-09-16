// geminiHandler.js

/**
 * Handles the process of opening the Gemini tab and interacting with its UI.
 */
export async function handleGeminiInteraction() {
  try {
    const tab = await chrome.tabs.create({ url: "https://gemini.google.com/app" });
    const exec = async (fn, ...args) => (await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fn, args }))?.[0]?.result;
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

    await Promise.all([wait("bard-mode-switcher"), wait("input-area-v2")]);

    await click("bard-mode-switcher button");
    for (let i = 0; i < 10; i++) {
      if (await exists(".cdk-overlay-container")) break;
      await new Promise(r => setTimeout(r, 300));
    }

    if (!(await exists(".cdk-overlay-container"))) return;

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

    await wait('input-area-v2 rich-textarea [role="textbox"]', 25);
    await exec(() => {
      const tb = document.querySelector('input-area-v2 rich-textarea [role="textbox"]');
      if (!tb) return;
      tb.focus();
      tb.innerText = 'hello';
      tb.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    });

    for (let att = 0; att < 10; att++) {
      const isEmpty = await exec(() => {
        const tb = document.querySelector('input-area-v2 rich-textarea [role="textbox"]');
        const empty = tb ? tb.innerText.trim() === '' : true;
        console.log(empty ? "yes" : "No");
        return empty;
      });
      if (isEmpty) break;
      if (await exists('input-area-v2 button[aria-label="Send message"]')) {
        await click('input-area-v2 button[aria-label="Send message"]');
      } else {
        await exec(() => {
          const tb = document.querySelector('input-area-v2 rich-textarea [role="textbox"]');
          if (!tb) return;
          tb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
        });
      }
      if (att < 9) await new Promise(r => setTimeout(r, 300));
    }
  } catch (e) {
    console.error("Error:", e);
  }
}