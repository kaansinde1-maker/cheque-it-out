import React from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import "@fontsource/dm-serif-display/400.css";
import "@fontsource/dm-mono/500.css";
import "./base.css";
import App from "./App.jsx";

// Uygulama, claude.ai artifact'ındaki `window.storage` API'sini kullanıyor.
// Burada aynı API'nin cihazdaki localStorage karşılığını sağlıyoruz (veri telefonda kalır).
window.storage = {
  get: async (key) => {
    const value = localStorage.getItem(key);
    return value === null ? null : { key, value };
  },
  set: async (key, value) => {
    localStorage.setItem(key, value);
    return { key, value };
  },
};

// Android'de dosya indirme çalışmaz; bunun yerine dosya yazılıp paylaşım menüsü açılır
// (Drive'a kaydet, WhatsApp/e-posta ile gönder vb.).
if (Capacitor.isNativePlatform()) {
  window.nativeSaveFile = async (name, text) => {
    const file = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: name, url: file.uri, dialogTitle: "Kaydet / paylaş" });
  };
}

createRoot(document.getElementById("root")).render(<App />);
