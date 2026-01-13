"use client";

import { useState, useEffect, useCallback } from "react";
import { locales, Lang, LocaleKey } from "@/data/locales";

// Simple event bus for language changes across components if needed, 
// though for this app simple local state or URL param might suffice. 
// We'll use localStorage to persist preference.

export function useTranslation() {
    const [lang, setLang] = useState<Lang>("TH");

    useEffect(() => {
        const saved = localStorage.getItem("app_lang") as Lang;
        if (saved && (saved === "TH" || saved === "EN")) {
            setLang(saved);
        }
    }, []);

    const toggleLang = () => {
        const next = lang === "TH" ? "EN" : "TH";
        setLang(next);
        localStorage.setItem("app_lang", next);
    };

    const t = useCallback((key: LocaleKey, params?: Record<string, string | number>) => {
        let text = locales[lang][key] || key;

        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                text = text.replace(`{${k}}`, String(v));
            });
        }
        return text;
    }, [lang]);

    return { t, lang, toggleLang, setLang };
}
