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

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["measure-page.js"],
    });

    const isEnabled = await readInjectedState(tab.id);
    await setActionState(tab.id, isEnabled);
  } catch (error) {
    await clearActionState(tab.id);
    console.error("Failed to toggle page height overlay.", error);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    await clearActionState(tabId);
  }
});
