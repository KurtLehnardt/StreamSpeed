// update chrome.tabs to chrome.scripts
// https://developer.chrome.com/docs/extensions/reference/scripting/#method-executeScript
// user v3 or higher in manifest
async function injectScript() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['./speedChanger.js']
    });
    window.close();
}
injectScript()
