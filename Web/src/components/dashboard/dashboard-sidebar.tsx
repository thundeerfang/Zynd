"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings, UserRound } from "lucide-react";

import {
  DASHBOARD_HEADER_CLASS,
  DASHBOARD_SIDEBAR_SECTION_GAP,
  DASHBOARD_SIDEBAR_WIDTH,
} from "@/components/dashboard/dashboard-layout";
import { DASHBOARD_NAV } from "@/components/dashboard/dashboard-nav";
import { useDashboardSection } from "@/components/dashboard/dashboard-section-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

function getInitials(firstName?: string | null, email?: string) {
  if (firstName?.trim()) {
    return firstName.trim().charAt(0).toUpperCase();
  }
  return email?.charAt(0).toUpperCase() ?? "U";
}

function navButtonClass(active: boolean) {
  return cn(
    "flex size-10 items-center justify-center rounded-full transition-colors outline-none",
    active
      ? "bg-foreground text-background"
      : "text-muted-foreground hover:bg-muted hover:text-foreground"
  );
}

function SidebarNavItem({
  item,
  active,
  onSelect,
}: {
  item: (typeof DASHBOARD_NAV)[number];
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = item.icon;
  const icon = <Icon className="size-[18px]" strokeWidth={active ? 2.25 : 2} />;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-current={active ? "page" : undefined}
            className={navButtonClass(active)}
            aria-label={item.label}
            onClick={onSelect}
          />
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

function MobileNavItem({
  item,
  active,
  onSelect,
}: {
  item: (typeof DASHBOARD_NAV)[number];
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      className={navButtonClass(active)}
      aria-label={item.label}
      onClick={onSelect}
    >
      <Icon className="size-[18px]" strokeWidth={active ? 2.25 : 2} />
    </button>
  );
}

function ProfileAvatar({
  withMenu,
  menuSide = "right",
  menuAlign = "end",
}: {
  withMenu?: boolean;
  menuSide?: "top" | "right" | "bottom" | "left";
  menuAlign?: "start" | "center" | "end";
}) {
  const router = useRouter();
  const { user, displayName, signOut } = useAuth();
  const initials = getInitials(user?.first_name, user?.email);
  const profileLabel = displayName || user?.email || "Profile";

  const avatar = (
    <Avatar className="size-14">
      <AvatarFallback className="bg-primary/10 text-h4 font-semibold text-primary">
        {initials}
      </AvatarFallback>
    </Avatar>
  );

  if (!withMenu) {
    return (
      <button type="button" aria-label={profileLabel} className="rounded-full">
        {avatar}
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={profileLabel}
        className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        render={<button type="button" className="rounded-full" />}
      >
        {avatar}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={menuSide}
        align={menuAlign}
        sideOffset={menuSide === "top" ? 8 : 12}
        className="w-52"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-0.5">
              <span className="truncate font-medium text-foreground">
                {displayName || "Account"}
              </span>
              {user?.email ? (
                <span className="truncate text-caption text-muted-foreground">
                  {user.email}
                </span>
              ) : null}
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled>
            <UserRound />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
            <Settings />
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            onClick={async () => {
              await signOut();
              router.push("/");
              router.refresh();
            }}
          >
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DashboardSidebar({ className }: { className?: string }) {
  const { activeSection, setActiveSection } = useDashboardSection();

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col",
        DASHBOARD_SIDEBAR_WIDTH,
        DASHBOARD_SIDEBAR_SECTION_GAP,
        className
      )}
    >
      <div className={cn(DASHBOARD_HEADER_CLASS, "justify-center")}>
        <Link href="/dashboard" className="shrink-0 rounded-full bg-background p-1.5 shadow-zynd-mid">
          <Image
            src="/logo.png"
            alt="ZYND"
            width={44}
            height={44}
            className="size-11 rounded-full object-cover"
            priority
          />
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-between">
        <nav className="flex shrink-0 flex-col items-center gap-1 rounded-[var(--radius-full)] bg-background p-2 shadow-zynd-mid">
          {DASHBOARD_NAV.map((item) => (
            <SidebarNavItem
              key={item.id}
              item={item}
              active={activeSection === item.id}
              onSelect={() => setActiveSection(item.id)}
            />
          ))}
        </nav>

        <ProfileAvatar withMenu />
      </div>
    </aside>
  );
}

export function DashboardMobileNav() {
  const { activeSection, setActiveSection } = useDashboardSection();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-muted/40 backdrop-blur-[var(--blur-sm)] md:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-2">
        {DASHBOARD_NAV.map((item) => (
          <MobileNavItem
            key={item.id}
            item={item}
            active={activeSection === item.id}
            onSelect={() => setActiveSection(item.id)}
          />
        ))}
        <ProfileAvatar withMenu menuSide="top" menuAlign="end" />
      </div>
    </nav>
  );
}
