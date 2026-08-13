import { useEffect, useState } from "react";
import { PrimaryButton, GhostButton } from "./ui";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "racket-install-prompt-dismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem(DISMISSED_KEY, "1");
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  };

  if (!visible || !deferred) return null;

  return (
    <div
      className="animate-slide-up"
      style={{
        position: "fixed",
        bottom: 76,
        left: 16,
        right: 16,
        zIndex: 60,
        backgroundColor: "#14304B",
        borderRadius: 16,
        padding: 14,
        boxShadow: "0 8px 24px rgba(20,48,75,0.35)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 14, color: "#FBFAF7" }}>
          Install Racket
        </div>
        <div style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 12, color: "rgba(251,250,247,0.65)" }}>
          Add to your home screen for quick access
        </div>
      </div>
      <GhostButton onClick={dismiss} className="!text-white/60">
        Not now
      </GhostButton>
      <PrimaryButton onClick={install} style={{ width: "auto", padding: "0 18px" }}>
        Install
      </PrimaryButton>
    </div>
  );
}
