"use client";

import { useState } from "react";
import { Settings, LogOut, ChevronDown } from "lucide-react";
import { useSession } from "@/trpc/session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ProfileDialog } from "./profile-dialog";

export function ProfileMenu() {
  const session = useSession();
  const [profileOpen, setProfileOpen] = useState(false);

  if (session.status !== "authenticated" || !session.user) {
    return null;
  }

  const userInitials = session.user.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : session.user.email?.[0]?.toUpperCase() ?? "U";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-9 gap-2 px-2 sm:px-3 border-border/70 hover:bg-muted w-full sm:w-auto justify-start sm:justify-center"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
              {userInitials}
            </div>
            <span className="truncate max-w-[140px] text-xs font-medium">
              {session.user.name ?? session.user.email}
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-auto sm:ml-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {session.user.name ?? "User"}
              </p>
              <p className="text-xs leading-none text-muted-foreground truncate">
                {session.user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setProfileOpen(true)}
            className="cursor-pointer"
          >
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => session.signOut()}
            className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}

