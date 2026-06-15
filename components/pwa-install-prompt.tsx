"use client";

import { useEffect, useState } from "react";
import { Download, MoreVertical, Share, Smartphone } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

function usePwaInstall() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  
  const isIOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isMobile = 
    typeof navigator !== "undefined" && 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  useEffect(() => {
    setIsMounted(true);
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const navigatorWithStandalone = navigator as Navigator & {
      standalone?: boolean;
    };
    
    const updateInstalledState = () => {
      setIsInstalled(
        standaloneQuery.matches || navigatorWithStandalone.standalone === true,
      );
    };

    updateInstalledState();
    
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setIsInstalled(false);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
      setShowInstructions(false);
    };

    standaloneQuery.addEventListener("change", updateInstalledState);
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      standaloneQuery.removeEventListener("change", updateInstalledState);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) {
      setShowInstructions(true);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);

    if (choice.outcome === "accepted") {
      setIsInstalled(true);
    }
  }

  return {
    isMounted,
    isInstalled,
    isIOS,
    isMobile,
    showInstructions,
    setShowInstructions,
    installApp
  };
}

export function PwaInstallPrompt() {
  const { isMounted, isInstalled, isIOS, isMobile, showInstructions, setShowInstructions, installApp } = usePwaInstall();

  // Prevent hydration mismatch by not rendering until mounted
  if (!isMounted) return null;

  if (isInstalled) {
    return null;
  }

  return (
    <>
      <section className="mb-5 flex items-center gap-3 rounded-2xl border border-primary/20 bg-card/80 p-3 shadow-sm">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          {isMobile ? <Smartphone className="size-5" aria-hidden="true" /> : <Download className="size-5" aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {isMobile ? "Download App" : "Install Niribi"}
          </p>
          <p className="text-xs text-muted-foreground">
            Add to your home screen for the best experience.
          </p>
        </div>
        <Button type="button" size="sm" onClick={installApp}>
          {isMobile ? "Download" : "Install"}
        </Button>
      </section>

      <PwaInstallInstructionsDialog 
        open={showInstructions} 
        onOpenChange={setShowInstructions} 
        isIOS={isIOS} 
      />
    </>
  );
}

export function PwaInstallFooterLink() {
  const { isMounted, isInstalled, isIOS, isMobile, showInstructions, setShowInstructions, installApp } = usePwaInstall();

  if (!isMounted) return null;
  
  // Hide if already installed
  if (isInstalled) return null;

  return (
    <>
      <button
        type="button"
        onClick={installApp}
        className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
      >
        {isMobile ? <Smartphone className="size-3.5" /> : <Download className="size-3.5" />}
        <span>{isMobile ? "Download App" : "Install App"}</span>
      </button>

      <PwaInstallInstructionsDialog 
        open={showInstructions} 
        onOpenChange={setShowInstructions} 
        isIOS={isIOS} 
      />
    </>
  );
}

function PwaInstallInstructionsDialog({ open, onOpenChange, isIOS }: { open: boolean, onOpenChange: (open: boolean) => void, isIOS: boolean }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Add Niribi to your home screen</AlertDialogTitle>
          <AlertDialogDescription>
            {isIOS
              ? "Safari requires installation from its Share menu."
              : "Your browser hasn't prompted the automatic install yet. You can still install Niribi manually."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="mt-4 flex items-start gap-3 rounded-xl bg-muted p-3 text-sm">
          {isIOS ? (
            <Share className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          ) : (
            <MoreVertical className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          )}
          <p className="leading-5 text-foreground">
            {isIOS
              ? "Tap Share, then choose Add to Home Screen."
              : "Open the browser menu, then choose Install app or Add to Home screen."}
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogAction>Got it</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
