export type View = { name: 'list' | 'signin' } | { name: 'detail' | 'edit'; id: string };

/** The address for a view. Editing happens at the movie's own address. */
export function urlFor(view: View, base: string): string {
  const path = 'id' in view ? 'movie/' + encodeURIComponent(view.id) : view.name === 'signin' ? 'kiki' : '.';
  return new URL(path, base).pathname;
}

/** The view an address opens: the sign-in page at kiki, a movie at movie/<id>, and the list anywhere else. */
export function viewFor(pathname: string, base: string): View {
  const root = new URL('.', base).pathname;
  const path = pathname.startsWith(root) ? pathname.slice(root.length).replace(/\/$/, '') : '';
  if (path === 'kiki') return { name: 'signin' };
  const id = /^movie\/([^/]+)$/.exec(path)?.[1];
  if (!id) return { name: 'list' };
  try {
    return { name: 'detail', id: decodeURIComponent(id) };
  } catch {
    return { name: 'list' };
  }
}
