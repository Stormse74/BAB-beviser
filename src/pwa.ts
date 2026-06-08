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
  Boolean((window.navigator as any).standalone);
