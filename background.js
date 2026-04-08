const setActionState = async (tabId, isEnabled) => {
  await chrome.action.setBadgeBackgroundColor({ tabId, color: "#0b8043" });
  await chrome.action.setBadgeText({ tabId, text: isEnabled ? "ON" : "" });
  await chrome.action.setTitle({
    tabId,
    title: isEnabled ? "Turn page height overlay off" : "Turn page height overlay on",
  });
};

const clearActionState = async (tabId) => {
  await chrome.action.setBadgeText({ tabId, text: "" });
  await chrome.action.setTitle({ tabId, title: "Toggle page height overlay" });
};

const setUnavailableState = async (tabId) => {
  await chrome.action.setBadgeText({ tabId, text: "" });
  await chrome.action.setTitle({
    tabId,
    title: "Page height overlay is unavailable on this page",
  });
};

const isRestrictedUrl = (url) => {
  if (!url) {
    return true;
  }

  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("devtools://") ||
    url.startsWith("view-source:") ||
    url.startsWith("https://chromewebstore.google.com/")
  );
};

const isExpectedInjectionFailure = (error) => {
  const message = String(error?.message ?? "");

  return (
    message.includes("Cannot access contents of the page") ||
    message.includes("The extensions gallery cannot be scripted") ||
    message.includes("Missing host permission") ||
    message.includes("No tab with id") ||
    message.includes("Frame with ID 0 was removed")
  );
};

const readInjectedState = async (tabId) => {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => Boolean(globalThis.__chromePageHeightOverlay?.isEnabled?.()),
  });

  return Boolean(results[0]?.result);
};

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) {
    return;
  }

  if (isRestrictedUrl(tab.url)) {
    await setUnavailableState(tab.id);
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["measure-page.js"],
    });

    const isEnabled = await readInjectedState(tab.id);
    await setActionState(tab.id, isEnabled);
  } catch (error) {
    if (isExpectedInjectionFailure(error)) {
      await setUnavailableState(tab.id);
      return;
    }

    await clearActionState(tab.id);
    console.error("Failed to toggle page height overlay.", error);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    await clearActionState(tabId);
  }
});
