let activePopup = null;
let channelData = null;
let channelDataError = "";
let observer = null;
let lastUrl = location.href;

function safeGetURL(path) {
  try {
    // Firefox uses browser API, Chrome uses chrome API
    if (typeof browser !== "undefined" && browser.runtime && browser.runtime.getURL) {
      return browser.runtime.getURL(path);
    }
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
      return chrome.runtime.getURL(path);
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
      console.log("YT Equity Plus: Loaded", channelData.length, "channels");
      runInjection();
    })
    .catch((e) => {
      channelDataError = "Unable to load data";
      console.error("YT Equity Plus: Failed to load data", e);
    });
} else {
  channelDataError = "Extension unavailable";
  console.error("YT Equity Plus: Could not get data URL");
}

function getChannelIdentifier() {
  let id = "";

  if (location.href.includes("/watch?v=")) {
    const linkEl = document.querySelector(
      "a.yt-simple-endpoint.style-scope.ytd-video-owner-renderer"
    );
    if (linkEl && linkEl.href.includes("/@")) {
      id = "@" + linkEl.href.split("/@")[1].split("/")[0];
    } else {
      console.log("YT Equity Plus: Couldn't find channel handle in video owner link");
    }
  } else if (location.href.includes("/channel/")) {
    id = location.href.split("/channel/")[1].split(/[/?#]/)[0];
  } else if (location.href.includes("/@")) {
    id = "@" + location.href.split("/@")[1].split(/[/?#]/)[0];
  }

  console.log("YT Equity Plus: Channel identifier:", id);
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
      document.querySelector("ytd-c4-tabbed-header-renderer #inner-header-container") ||
      document.querySelector("#inner-header-container") ||
      document.querySelector("yt-page-header-renderer #inner-header-container") ||
      document.querySelector("#channel-header") ||
      document.querySelector("ytd-c4-tabbed-header-renderer") ||
      document.querySelector("yt-flexible-actions-view-model") ||
      document.querySelector("h1.dynamic-text-view-model-wiz__h1");
  }

  console.log("YT Equity Plus: Badge container:", container);
  return container;
}

function handleOutsideClick(ev) {
  if (activePopup && !activePopup.contains(ev.target)) {
    activePopup.remove();
    document.removeEventListener("click", handleOutsideClick);
    const btn = document.querySelector("#pe-check-button");
    if (btn) btn.classList.remove("button-active");

    const ping = document.querySelector("#pe-ping");
    if (ping) ping.remove();

    activePopup = null;
  }
}

window.addEventListener("yt-page-data-updated", (e) => {
  if (activePopup) {
    activePopup.remove();
    document.removeEventListener("click", handleOutsideClick);
    activePopup = null;
  }
  runInjection();
});

function injectButton(container, { found, error }) {
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

  let ping = null;
  if (found) {
    ping = document.createElement("span");
    ping.id = "pe-ping";
    wrapper.appendChild(ping);
  }

  container.appendChild(wrapper);

  button.addEventListener("click", () => {
    if (activePopup) {
      activePopup.remove();
      document.removeEventListener("click", handleOutsideClick);
      activePopup = null;
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
        <strong>Investment Status:</strong>
        ${found.level.charAt(0).toUpperCase() + found.level.slice(1)}
        ${found.type === "funding" ? "Funding" : "Acquisition"}
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
        <strong>Investment Status:</strong> Independent
      `;
      list.appendChild(li);
    }

    const closeBtn = document.createElement("span");
    closeBtn.id = "pe-popup-close";
    const closeMarkup = iconMarkup("icons/close.svg");
    closeBtn.innerHTML = closeMarkup || "×";

    closeBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      popup.remove();
      activePopup = null;
      button.classList.remove("button-active");
      if (ping) ping.remove();
      document.removeEventListener("click", handleOutsideClick);
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
  if (!channelData) {
    console.log("YT Equity Plus: No channel data loaded");
    return null;
  }

  console.log("YT Equity Plus: Looking for channel:", id);

  let found = null;
  if (id.includes("@")) {
    found = channelData.find(
      (ch) => ch.channelHandle.toLowerCase() === id.toLowerCase()
    );
  } else {
    found = channelData.find(
      (ch) => ch.channelId.toLowerCase() === id.toLowerCase()
    );
  }

  console.log("YT Equity Plus: Found result:", found);
  return found;
}

function runInjection() {
  const id = getChannelIdentifier();
  if (!id) {
    console.log("YT Equity Plus: No channel identifier found");
    return;
  }

  const found = computeFound(id);
  const container = findBadgeContainer();
  if (!container) {
    console.log("YT Equity Plus: No badge container found");
    return;
  }

  console.log("YT Equity Plus: Injecting button with result:", found ? "FOUND" : "NOT FOUND");
  injectButton(container, { found, error: channelDataError });
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
      console.log("YT Equity Plus: URL changed to:", location.href);
      runInjection();
    }
  }, 500);
}

console.log("YT Equity Plus: Content script loaded");
startObserver();
startUrlWatcher();
runInjection();
