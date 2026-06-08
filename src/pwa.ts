export const registerServiceWorker = () => {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Appen fungerer stadig online, hvis browseren afviser service worker.
      });
    });
  }
};

export const isInstalledMode = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.matchMedia("(display-mode: fullscreen)").matches ||
  Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
