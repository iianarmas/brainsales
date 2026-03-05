'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { LoginForm } from '@/components/LoginForm';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Download, Shield, CheckCircle, Monitor, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';


export default function DownloadPage() {
  const { user, loading } = useAuth();
  const [showSmartscreen, setShowSmartscreen] = useState(false);

  if (loading) return <LoadingScreen fullScreen={true} />;
  if (!user) return <LoginForm />;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to BrainSales
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-primary mb-2">BrainSales Companion</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            The desktop app that listens to your calls and powers real-time AI navigation.
            Install it once and it runs in the background automatically.
          </p>
        </div>

        {/* Download Card */}
        <div className="bg-surface border border-border rounded-2xl p-6 mb-4 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="bg-primary/10 rounded-xl p-3 flex-shrink-0">
              <Monitor className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-foreground mb-0.5">Windows Installer</h2>
              <p className="text-sm text-muted-foreground mb-4">Windows 10 / 11 · 64-bit</p>
              <button
                disabled
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold opacity-50 cursor-not-allowed shadow-md"
              >
                <Download className="h-4 w-4" />
                Download for Windows
              </button>
              <p className="text-xs text-muted-foreground mt-3">
                Download coming soon.
              </p>
            </div>
          </div>
        </div>

        {/* Installation Steps */}
        <div className="bg-surface border border-border rounded-2xl p-6 mb-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Installation</h3>
          <ol className="space-y-3">
            {[
              'Download the .exe installer from the link above',
              'Run the downloaded file',
              'If Windows shows a SmartScreen warning — click "More info", then "Run anyway"',
              'Follow the installation wizard (takes about 30 seconds)',
              'The app will launch automatically and appear in the bottom-right corner of your screen',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* SmartScreen FAQ */}
        <div className="bg-surface border border-border rounded-2xl overflow-hidden mb-4">
          <button
            onClick={() => setShowSmartscreen(!showSmartscreen)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-surface-hover transition-colors"
          >
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm font-semibold text-foreground">
                Why does Windows warn me about this app?
              </span>
            </div>
            {showSmartscreen
              ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            }
          </button>
          {showSmartscreen && (
            <div className="px-6 pb-5 border-t border-border-subtle">
              <p className="text-sm text-muted-foreground mt-4 leading-relaxed mb-3">
                Windows SmartScreen warns about apps that don't have a code signing certificate.
                Certificates cost several hundred dollars per year and are typically added once an
                app reaches wider public release — during this testing phase the app is unsigned.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                The app is completely safe to install. If you want to verify, the full source code
                is available on GitHub.
              </p>
              <p className="text-sm font-medium text-foreground mb-2">To get past the warning:</p>
              <ol className="space-y-2">
                {[
                  'When SmartScreen appears, click "More info" (small grey link below the warning)',
                  'A "Run anyway" button will appear — click it',
                  'The installer will proceed normally',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary font-bold text-xs mt-0.5 flex-shrink-0">{i + 1}.</span>
                    <span className="text-sm text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* After Install */}
        <div className="bg-surface border border-border rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">After installing</h3>
          <ul className="space-y-3">
            {[
              'The app sits in the bottom-right corner of your screen',
              'Clicking the X button hides it to the system tray (look near the clock, bottom-right of taskbar)',
              'Click the tray icon to bring it back; right-click for options',
              'The app starts automatically every time Windows boots',
              "You'll be notified inside the app when a new version is available",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
