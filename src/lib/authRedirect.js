/**
 * The app's own base URL, used as the Supabase signUp emailRedirectTo so the
 * confirmation link lands back on the app (e.g. https://app.sk8happy.com/)
 * rather than the bare origin. Query string and hash are dropped; a trailing file
 * segment such as index.html is removed; the result always ends with '/'.
 * @param {{origin: string, pathname: string}} loc  window.location (or a stand-in)
 */
export function appBaseUrl(loc) {
  let path = loc.pathname || '/';
  const last = path.slice(path.lastIndexOf('/') + 1);
  if (last.includes('.')) path = path.slice(0, path.length - last.length);
  if (!path.endsWith('/')) path += '/';
  return `${loc.origin}${path}`;
}
