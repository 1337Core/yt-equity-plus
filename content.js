let activePopup = null;
let channelData = null;
let channelDataError = "";
let observer = null;
let lastUrl = location.href;
let injectionRetryTimeout = null;
const dismissedBadgeStorageKey = "pe-dismissed-badge-keys";

const runtimeApi =
  (typeof browser !== "undefined" && browser.runtime) ||
  (typeof chrome !== "undefined" && chrome.runtime) ||
  null;

function loadDismissedBadgeKeys() {
  try {
    const raw = window.sessionStorage.getItem(dismissedBadgeStorageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((key) => typeof key === "string"));
    }
  } catch (_) {}
  return new Set();
}

const dismissedBadgeKeys = loadDismissedBadgeKeys();

function persistDismissedBadgeKeys() {
  try {
    window.sessionStorage.setItem(
      dismissedBadgeStorageKey,
      JSON.stringify([...dismissedBadgeKeys]),
    );
  } catch (_) {}
}

function safeGetURL(path) {
  try {
    if (runtimeApi && typeof runtimeApi.getURL === "function") {
      return runtimeApi.getURL(path);
    }
  } catch (_) {}
  return null;
}

function iconMarkup(path) {
  const u = safeGetURL(path);
  return u ? `<img src="${u}" width="16" height="16" />` : "";
}

const dataUrl = safeGetURL("/data/channels.json");
if (dataUrl) {
  fetch(dataUrl)
    .then((res) => res.json())
    .then((json) => {
      channelData = json.channels;
      channelDataError = "";
      scheduleInjection(500);
    })
    .catch((e) => {
      channelDataError = "Unable to load data";
    });
} else {
  channelDataError = "Extension unavailable";
}

function getChannelIdentifier() {
  let id = "";

  if (location.href.includes("/watch?v=")) {
    const linkEl = document.querySelector(
      "a.yt-simple-endpoint.style-scope.ytd-video-owner-renderer",
    );
    if (linkEl && linkEl.href.includes("/@")) {
      id = "@" + linkEl.href.split("/@")[1].split("/")[0];
    } else {
      console.log("Couldn't find channel handle in video owner link");
    }
  } else if (location.href.includes("/channel/")) {
    id = location.href.split("/channel/")[1].split(/[/?#]/)[0];
  } else if (location.href.includes("/@")) {
    id = "@" + location.href.split("/@")[1].split(/[/?#]/)[0];
  }

  return id;
}

function findBadgeContainer() {
  let container = null;

  if (location.href.includes("/watch?v=")) {
    container = document.querySelector("#owner");
  } else if (
    location.href.includes("/@") ||
    location.href.includes("/channel/")
  ) {
    container =
      document.querySelector("ytd-c4-tabbed-header-renderer #buttons") ||
      document.querySelector("#inner-header-container #buttons") ||
      document.querySelector("#channel-header #buttons") ||
      document.querySelector(
        "ytd-c4-tabbed-header-renderer #inner-header-container",
      ) ||
      document.querySelector("#inner-header-container") ||
      document.querySelector(
        "yt-page-header-renderer #inner-header-container",
      ) ||
      document.querySelector("#channel-header") ||
      document.querySelector("ytd-c4-tabbed-header-renderer") ||
      document.querySelector("yt-flexible-actions-view-model") ||
      document.querySelector("h1.dynamic-text-view-model-wiz__h1");
  }

  return container;
}

function handleOutsideClick(ev) {
  if (activePopup && !activePopup.contains(ev.target)) {
    closeActivePopup();
  }
}

window.addEventListener("yt-page-data-updated", (e) => {
  closeActivePopup();
  scheduleInjection(500);
});

function closeActivePopup() {
  if (!activePopup) return;
  activePopup.remove();
  activePopup = null;
  document.removeEventListener("click", handleOutsideClick);

  const btn = document.querySelector("#pe-check-button");
  if (btn) btn.classList.remove("button-active");
}

function removeInjectedUI() {
  closeActivePopup();
  const wrapper = document.querySelector("#pe-check-button-wrapper");
  if (wrapper) wrapper.remove();
}

function getBadgeKey(id, found) {
  return (found?.channelId || found?.channelHandle || id || "").toLowerCase();
}

function dismissBadge(badgeKey, wrapper) {
  if (!badgeKey) return;
  dismissedBadgeKeys.add(badgeKey);
  persistDismissedBadgeKeys();
  const ping = wrapper.querySelector("#pe-ping");
  if (ping) ping.remove();
}

function injectButton(container, { found, error, badgeKey }) {
  const existing = document.querySelector("#pe-check-button-wrapper");
  if (existing && container.contains(existing)) return;
  if (existing) existing.remove();

  const wrapper = document.createElement("span");
  wrapper.id = "pe-check-button-wrapper";

  const button = document.createElement("button");
  button.id = "pe-check-button";
  button.innerHTML = `🧐`;
  button.disabled = !error && !channelData;
  if (error) button.title = error;
  else if (!channelData) button.title = "Loading…";
  else button.title = "Check PE ownership";
  wrapper.appendChild(button);

  const shouldShowPing = found && badgeKey && !dismissedBadgeKeys.has(badgeKey);
  if (shouldShowPing) {
    const ping = document.createElement("span");
    ping.id = "pe-ping";
    wrapper.appendChild(ping);
  }

  container.appendChild(wrapper);

  button.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (found) dismissBadge(badgeKey, wrapper);

    const isTogglingCurrentPopup =
      activePopup && button.classList.contains("button-active");

    if (isTogglingCurrentPopup) {
      closeActivePopup();
      return;
    }

    closeActivePopup();

    if (!document.body) {
      return;
    }

    const popup = document.createElement("div");
    popup.id = "pe-popup";
    const rect = button.getBoundingClientRect();
    popup.style.top = `${rect.bottom + window.scrollY + 5}px`;
    popup.style.left = `${rect.left + window.scrollX}px`;

    const list = document.createElement("ul");

    if (error) {
      const li = document.createElement("li");
      li.innerHTML = `
            ${iconMarkup("icons/error.svg")}
            ${error}
        `;
      list.appendChild(li);
    } else if (found) {
      const li1 = document.createElement("li");
      li1.innerHTML = `
        ${iconMarkup("icons/money.svg")}
        <strong>Status:</strong>
        ${found.type === "funding" ? "Funded" : "Acquired"}
      `;
      list.appendChild(li1);

      if (found.firmName && found.firmWebsite) {
        const li2 = document.createElement("li");
        li2.innerHTML = `
          ${iconMarkup("icons/institution.svg")}
          ${
            found.type === "funding"
              ? "<strong>Funded By:</strong>"
              : "<strong>Acquired By:</strong>"
          }
          <a href="${found.firmWebsite}" target="_blank">${found.firmName}</a>
        `;
        list.appendChild(li2);
      }

      const li3 = document.createElement("li");
      li3.innerHTML = `
        ${iconMarkup("icons/link.svg")}
        <strong>Source:</strong>
        <a href="${found.source}" target="_blank">Official Website</a>
      `;
      list.appendChild(li3);
    } else {
      const li = document.createElement("li");
      li.innerHTML = `
        ${iconMarkup("icons/money.svg")}
        <strong>Status:</strong> Independent
      `;
      list.appendChild(li);
    }

    const closeBtn = document.createElement("span");
    closeBtn.id = "pe-popup-close";
    const closeMarkup = iconMarkup("icons/close.svg");
    closeBtn.innerHTML = closeMarkup || "×";

    closeBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      closeActivePopup();
    });

    popup.appendChild(closeBtn);
    popup.appendChild(list);
    document.body.appendChild(popup);
    activePopup = popup;
    button.classList.add("button-active");

    setTimeout(() => document.addEventListener("click", handleOutsideClick), 0);
  });
}

function computeFound(id) {
  if (!channelData) return null;
  if (id.includes("@")) {
    return channelData.find(
      (ch) => ch.channelHandle.toLowerCase() === id.toLowerCase(),
    );
  }
  return channelData.find(
    (ch) => ch.channelId.toLowerCase() === id.toLowerCase(),
  );
}

function scheduleInjection(delay = 0) {
  clearTimeout(injectionRetryTimeout);
  injectionRetryTimeout = window.setTimeout(() => {
    injectionRetryTimeout = null;
    runInjection();
  }, delay);
}

function runInjection() {
  const id = getChannelIdentifier();
  if (!id) {
    removeInjectedUI();
    return;
  }

  const found = computeFound(id);
  const badgeKey = getBadgeKey(id, found);

  if (channelData && !found && !channelDataError) {
    removeInjectedUI();
    return;
  }

  const container = findBadgeContainer();
  if (!container) {
    scheduleInjection(500);
    return;
  }

  injectButton(container, { found, error: channelDataError, badgeKey });
}

function debounce(fn, wait) {
  let t;
  return function () {
    clearTimeout(t);
    t = setTimeout(fn, wait);
  };
}

function startObserver() {
  if (observer) observer.disconnect();
  const debounced = debounce(runInjection, 200);
  observer = new MutationObserver(() => debounced());
  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
  });
}

function startUrlWatcher() {
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      scheduleInjection(500);
    }
  }, 500);
}

startObserver();
startUrlWatcher();
scheduleInjection(500);
