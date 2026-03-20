import { usePathname, useRouter, type Href } from 'expo-router';

function normalizePath(path: string) {
  const withoutQuery = path.split('?')[0]?.split('#')[0] ?? path;

  if (!withoutQuery || withoutQuery === '/') {
    return '/';
  }

  return withoutQuery.endsWith('/') ? withoutQuery.slice(0, -1) : withoutQuery;
}

function resolveHrefPath(href: Href) {
  if (typeof href === 'string') {
    return normalizePath(href);
  }

  if (typeof href.pathname !== 'string') {
    return null;
  }

  let resolvedPath = href.pathname;
  const params = 'params' in href ? href.params : undefined;

  if (params) {
    for (const [key, rawValue] of Object.entries(params)) {
      if (rawValue === undefined || rawValue === null) {
        continue;
      }

      const value = Array.isArray(rawValue) ? rawValue.join('/') : String(rawValue);
      resolvedPath = resolvedPath
        .replace(`[[...${key}]]`, value)
        .replace(`[...${key}]`, value)
        .replace(`[${key}]`, value);
    }
  }

  return normalizePath(resolvedPath);
}

export function useSafePush() {
  const router = useRouter();
  const pathname = usePathname();
  const currentPath = normalizePath(pathname);

  function isCurrentHref(href: Href) {
    const targetPath = resolveHrefPath(href);
    if (!targetPath) {
      return false;
    }

    return targetPath === currentPath;
  }

  function safePush(href: Href) {
    if (isCurrentHref(href)) {
      return false;
    }

    router.push(href);
    return true;
  }

  return {
    currentPath,
    isCurrentHref,
    safePush,
  };
}
