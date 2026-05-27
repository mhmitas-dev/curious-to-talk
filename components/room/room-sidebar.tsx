"use client";

import type { ReactNode } from "react";
import {
  LayoutGrid,
  MessageSquare,
  Settings,
  Users,
  X,
} from "lucide-react";
import type { SidebarTab } from "./room-types";

interface RoomSidebarProps {
  activeTab: SidebarTab;
  appsContent: ReactNode;
  chatContent: ReactNode;
  onClose: () => void;
  onOpenTab: (tab: SidebarTab) => void;
  open: boolean;
  settingsContent: ReactNode;
  socialContent: ReactNode;
  unreadSocialCount: number;
}

const SIDEBAR_TABS: SidebarTab[] = ["chat", "apps", "social", "settings"];

function getTabIcon(tab: SidebarTab) {
  if (tab === "chat") return MessageSquare;
  if (tab === "apps") return LayoutGrid;
  if (tab === "social") return Users;
  return Settings;
}

export function RoomSidebar({
  activeTab,
  appsContent,
  chatContent,
  onClose,
  onOpenTab,
  open,
  settingsContent,
  socialContent,
  unreadSocialCount,
}: RoomSidebarProps) {
  return (
    <aside
      className={`fixed right-0 top-0 z-50 flex h-full w-[92vw] max-w-[380px] flex-col border-l border-border/35 bg-sidebar shadow-2xl transition-transform duration-300 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="grid grid-cols-[1fr_auto] bg-card px-2 pt-2 pb-0 shadow-sm">
        <div className="grid grid-cols-4">
          {SIDEBAR_TABS.map((tab) => {
            const Icon = getTabIcon(tab);

            return (
              <button
                key={tab}
                onClick={() => onOpenTab(tab)}
                className={`relative flex flex-1 items-center justify-center py-3 transition-colors ${
                  activeTab === tab
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={tab}
                aria-label={tab}
              >
                <Icon className="h-5 w-5" />
                {tab === "social" && unreadSocialCount > 0 && (
                  <span className="absolute right-4 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                    {unreadSocialCount > 9 ? "9+" : unreadSocialCount}
                  </span>
                )}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={onClose}
          className="relative flex w-12 items-center justify-center py-3 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close sidebar"
          title="close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "apps" && appsContent}
        {activeTab === "chat" && chatContent}
        {activeTab === "social" && socialContent}
        {activeTab === "settings" && settingsContent}
      </div>
    </aside>
  );
}
