import { useEffect } from "react";
import { Globe } from "lucide-react";

declare global {
  interface Window {
    google?: any;
    googleTranslateElementInit?: () => void;
  }
}

// Embeds Google Translate widget in a hidden container and shows a compact language dropdown
export function LanguageSwitcher() {
  useEffect(() => {
    if (document.getElementById("google-translate-script")) return;
    window.googleTranslateElementInit = () => {
      new window.google.translate.TranslateElement(
        {
          pageLanguage: "en",
          includedLanguages: "en,es,fr,de,ru,lt,lv,ar,hi,zh-CN,pt,it,uk,pl",
          layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
          autoDisplay: false,
        },
        "google_translate_element",
      );
    };
    const s = document.createElement("script");
    s.id = "google-translate-script";
    s.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  return (
    <div className="flex items-center gap-1.5" title="Translate page">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <div id="google_translate_element" className="[&_.goog-te-gadget]:!text-xs [&_.goog-te-gadget-simple]:!bg-transparent [&_.goog-te-gadget-simple]:!border-0 [&_.goog-te-gadget]:!font-normal" />
    </div>
  );
}
