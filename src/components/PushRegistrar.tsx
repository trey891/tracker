"use client";

import { useEffect } from "react";
import { isNative, registerPush } from "@/lib/native";

// Mounted once in the authenticated app shell. On the native iOS app it asks
// for push permission, registers with APNs, and stores the device token
// against the signed-in user. No-op in a normal browser.
export function PushRegistrar() {
  useEffect(() => {
    if (!isNative()) return;
    registerPush((token) => {
      fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, platform: "ios" }),
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  return null;
}
