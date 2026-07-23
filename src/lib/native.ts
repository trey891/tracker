"use client";

import { Capacitor } from "@capacitor/core";

// True only inside the native iOS/Android shell (false in a normal browser).
export const isNative = () => Capacitor.isNativePlatform();

// Capture or pick a photo using the device camera when running natively.
// Returns a File ready to upload through the existing /api/attachments flow.
// Returns null if the user cancels.
export async function takePhoto(): Promise<File | null> {
  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
  try {
    const photo = await Camera.getPhoto({
      quality: 80,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt, // let the user choose Camera or Photo Library
      allowEditing: false,
      promptLabelHeader: "Add a progress photo",
      promptLabelPhoto: "Choose from library",
      promptLabelPicture: "Take photo",
    });
    if (!photo.webPath) return null;
    const blob = await (await fetch(photo.webPath)).blob();
    const ext = photo.format || "jpeg";
    return new File([blob], `photo-${Date.now()}.${ext}`, { type: blob.type || `image/${ext}` });
  } catch {
    return null; // user cancelled
  }
}

// Register for push notifications (native only) and hand back the APNs token.
export async function registerPush(onToken: (token: string) => void): Promise<void> {
  if (!isNative()) return;
  const { PushNotifications } = await import("@capacitor/push-notifications");

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== "granted") return;

  await PushNotifications.removeAllListeners();
  await PushNotifications.addListener("registration", (t) => onToken(t.value));
  await PushNotifications.addListener("registrationError", () => {});
  await PushNotifications.register();
}
