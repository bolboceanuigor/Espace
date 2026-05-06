'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui';
import MainNavigation from '@/components/layout/MainNavigation';

interface PlatformLayoutProps {
  children: React.ReactNode;
  title: string;
  navItems: { name: string; href: string; icon: string }[];
}

export default function PlatformLayout({ children, title, navItems }: PlatformLayoutProps) {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  void navItems;

  useEffect(() => {
    if (!isAuthenticated) router.replace('/login');
  }, [isAuthenticated, router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,hsl(var(--muted))_0,transparent_36rem),hsl(var(--background))] text-foreground">
      <div className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-foreground text-sm font-semibold text-background">
                E
              </div>
              <div className="hidden min-w-0 sm:block">
                <span className="block truncate text-sm font-semibold tracking-tight text-foreground">Espace</span>
                <span className="block truncate text-xs text-muted-foreground">{title}</span>
              </div>
            </div>
            <div className="hidden flex-1 justify-center md:flex" />
            <div className="flex min-w-0 items-center justify-end gap-3">
              {user && (
                <div className="hidden min-w-0 items-center gap-2 md:flex">
                  <div className="min-w-0 truncate text-right">
                    <div className="truncate text-sm font-medium text-foreground">
                      {user.firstName} {user.lastName}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-white/80">
                    <span className="text-xs font-semibold text-foreground">
                      {user.firstName?.[0]}
                      {user.lastName?.[0]}
                    </span>
                  </div>
                </div>
              )}
              <Button variant="secondary" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 pb-[calc(env(safe-area-inset-bottom)+8.75rem)] pt-5 md:px-6 md:pb-[calc(env(safe-area-inset-bottom)+8.75rem)] md:pt-8">
          {children}
        </main>
        <MainNavigation role={user?.role} />
      </div>
    </div>
  );
}
