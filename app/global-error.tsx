"use client";

import { useEffect } from "react";
import { logDiagnostic } from "@/lib/api/errors";

// Rendered outside the root layout (no globals.css), so styles are self-contained.
// Colours mirror the light/dark tokens in globals.css.
const css = `
  .ge{margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;background:#f6f7f9;color:#111827;
    font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
  .ge-card{text-align:center;max-width:420px;animation:ge-in .25s cubic-bezier(.2,.8,.2,1) both}
  .ge-icon{margin:0 auto 16px;width:48px;height:48px;border-radius:999px;display:grid;place-items:center;background:rgba(220,38,38,.1);color:#dc2626}
  .ge h1{margin:0;font-size:24px;font-weight:600;letter-spacing:-.01em}
  .ge p{margin:8px 0 0;color:#4b5563;font-size:15px;line-height:1.5}
  .ge button{margin-top:20px;height:36px;padding:0 14px;border:0;border-radius:8px;background:#4f46e5;color:#fff;font-size:14px;font-weight:500;cursor:pointer}
  .ge button:focus-visible{outline:2px solid #4f46e5;outline-offset:2px}
  @media (prefers-color-scheme:dark){.ge{background:#0b0d12;color:#f3f4f6}.ge p{color:#9ca3af}}
  @keyframes ge-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
  @media (prefers-reduced-motion:reduce){.ge-card{animation:none}}
`;

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => logDiagnostic("warn", "application crashed", { error, digest: error.digest }), [error]);

  return (
    <html lang="en">
      <body className="ge">
        <style>{css}</style>
        <div className="ge-card" role="alert">
          <div className="ge-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
          </div>
          <h1>Something Went Wrong</h1>
          <p>We couldn’t load this page. Please try again.</p>
          <button type="button" onClick={reset}>
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
