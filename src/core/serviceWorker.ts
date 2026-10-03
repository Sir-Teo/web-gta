/** Registers the build's sw.js (scripts/serviceWorker.mjs): the installed game's page, scripts and styles come from the
 * phone's own storage, so it opens without waiting on the network and still opens without one. A production build
 * only (the dev server's modules are not hashed), not under automation (the browser specs load each build fresh), and
 * once the page has loaded, so the precache does not compete with the game's own start-up downloads. */
export function registerShell(
  nav: { serviceWorker?: { register(url: string, options: { scope: string }): Promise<unknown> }; webdriver?: boolean },
  win: { addEventListener(type: 'load', listener: () => void, options: { once: true }): void; document: { readyState: string } },
  production: boolean, base: string,
) {
  if (!production || nav.webdriver || !nav.serviceWorker) return false;
  const register = () => { nav.serviceWorker!.register(`${base}sw.js`, { scope: base }).catch(error => console.warn('The offline app shell did not install.', error)); };
  if (win.document.readyState === 'complete') register(); else win.addEventListener('load', register, { once: true });
  return true;
}
