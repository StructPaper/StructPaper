/**
 * A link that points into this app, with the domain the app is being used on.
 *
 * The server answers with where something lives ("/activate#token=..."), never with a domain: the one in a configuration file goes
 * stale the day the app moves, while the address bar always names the right one. A full address (http://...) is returned as it is.
 */
export function absoluteAppLink(pathOrUrl: string, origin?: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base.replace(/\/+$/, '')}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

/** The activation link of an invitation result, on this app's domain (falls back to the server's link for an older server). */
export function activationLinkOf(result: { activationPath?: string | null; activationUrl?: string | null }): string | null {
  const target = result.activationPath || result.activationUrl;
  return target ? absoluteAppLink(target) : null;
}
