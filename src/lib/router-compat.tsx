"use client";

import NextLink from "next/link";
import {
  usePathname,
  useRouter,
  useParams as useNextParams,
  useSearchParams as useNextSearchParams,
} from "next/navigation";
import React, { ComponentProps } from "react";

export function Link({
  to,
  href,
  children,
  ...props
}: {
  to?: string;
  href?: string;
  children: React.ReactNode;
} & Omit<ComponentProps<typeof NextLink>, "href">) {
  const target = to || href || "#";
  return (
    <NextLink href={target} {...props}>
      {children}
    </NextLink>
  );
}

export function useNavigate() {
  const router = useRouter();
  return (to: string | number, options?: { replace?: boolean }) => {
    if (typeof to === "number") {
      if (typeof window !== "undefined") {
        window.history.go(to);
      }
    } else {
      if (options?.replace) {
        router.replace(to);
      } else {
        router.push(to);
      }
    }
  };
}

export function useLocation() {
  const pathname = usePathname();
  const searchParams = useNextSearchParams();

  return {
    pathname: pathname || "/",
    search: searchParams ? `?${searchParams.toString()}` : "",
    hash: typeof window !== "undefined" ? window.location.hash : "",
    state: null,
  };
}

export function useParams<T extends Record<string, string | string[]> = Record<string, string>>() {
  const params = useNextParams();
  return (params || {}) as T;
}

export function useSearchParams(): [
  URLSearchParams,
  (
    nextInit:
      | Record<string, string | number>
      | URLSearchParams
      | ((prev: URLSearchParams) => URLSearchParams),
    options?: { replace?: boolean; preventScrollReset?: boolean }
  ) => void,
] {
  const searchParams = useNextSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const currentParams = React.useMemo(() => {
    return new URLSearchParams(searchParams ? searchParams.toString() : "");
  }, [searchParams]);

  const setSearchParams = React.useCallback(
    (
      nextInit:
        | Record<string, string | number>
        | URLSearchParams
        | ((prev: URLSearchParams) => URLSearchParams),
      options?: { replace?: boolean; preventScrollReset?: boolean }
    ) => {
      let nextParams: URLSearchParams;
      if (typeof nextInit === "function") {
        nextParams = nextInit(new URLSearchParams(currentParams));
      } else if (nextInit instanceof URLSearchParams) {
        nextParams = new URLSearchParams(nextInit);
      } else {
        nextParams = new URLSearchParams();
        Object.entries(nextInit).forEach(([k, v]) => {
          if (v !== undefined && v !== null) {
            nextParams.set(k, String(v));
          }
        });
      }

      const query = nextParams.toString();
      const url = `${pathname || "/"}${query ? `?${query}` : ""}`;
      if (options?.replace) {
        router.replace(url);
      } else {
        router.push(url);
      }
    },
    [currentParams, pathname, router]
  );

  return [currentParams, setSearchParams];
}

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const router = useRouter();
  React.useEffect(() => {
    if (replace) {
      router.replace(to);
    } else {
      router.push(to);
    }
  }, [router, to, replace]);
  return null;
}

export function Outlet({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

export function createBrowserRouter(routes: any[]) {
  return routes;
}

export function RouterProvider(_props: any) {
  return null;
}
