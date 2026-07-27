import { Theme } from '@astryxdesign/core/theme';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Stack } from '@astryxdesign/core/Stack';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Text } from '@astryxdesign/core/Text';
import { tanmatraTheme } from '@/lib/themes/tanmatra';

import '@/lib/themes/tanmatra.css';

export const metadata = {
  title: 'Astryx Design System Spike & Contrast Audit — Tanmatra',
  robots: 'noindex, nofollow',
};

function ModePreview({ mode, title }: { mode: 'system' | 'light' | 'dark'; title: string }) {
  return (
    <Theme theme={tanmatraTheme} mode={mode}>
      <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-background-app)] text-[var(--color-text-primary)] transition-colors">
        <Stack gap={4}>
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
            <h2 className="text-xl font-bold">{title}</h2>
            <span className="text-xs uppercase tracking-wider px-2 py-1 rounded bg-[var(--color-background-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
              Mode: {mode}
            </span>
          </div>

          <Card className="p-4">
            <Stack gap={3}>
              <Text className="text-sm font-semibold text-[var(--color-text-secondary)]">
                Brand Action & Contrast Verification
              </Text>
              <div className="flex flex-wrap gap-3">
                <Button label="Primary Gold Action" variant="primary" />
                <Button label="Secondary Action" variant="secondary" />
              </div>
            </Stack>
          </Card>

          <Card className="p-4">
            <Stack gap={3}>
              <Text className="text-sm font-semibold text-[var(--color-text-secondary)]">
                Input & Field States
              </Text>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <TextInput label="Delivery Pincode" value="" placeholder="Enter delivery pincode..." />
                <TextInput label="Location Area" value="110001 (Noida / NCR)" />
              </div>
            </Stack>
          </Card>

          <Card className="p-4">
            <Stack gap={3}>
              <Text className="text-sm font-semibold text-[var(--color-text-secondary)]">
                Semantic Status & Accent Indicators
              </Text>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                <div className="p-2 rounded border border-[var(--color-border)] text-[var(--color-accent)] bg-[var(--color-background-surface)]">
                  Gold Accent Text
                </div>
                <div className="p-2 rounded border border-[var(--color-border)] text-[var(--color-blue)] bg-[var(--color-background-surface)]">
                  Blue Indicator
                </div>
                <div className="p-2 rounded border border-[var(--color-border)] text-[var(--color-sage)] bg-[var(--color-background-surface)]">
                  Sage Protocol
                </div>
                <div className="p-2 rounded border border-[var(--color-border)] text-[var(--color-danger)] bg-[var(--color-background-surface)]">
                  Danger Warning
                </div>
              </div>
            </Stack>
          </Card>
        </Stack>
      </div>
    </Theme>
  );
}

export default function StyleguideAstryxPage() {
  return (
    <div className="min-h-screen bg-[var(--color-background-app)] text-[var(--color-text-primary)] p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Astryx Design System — Spike & Token Audit (DS-0)</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-2">
          Adoption Spike for @workspace/storefront · Theme: <code className="text-[var(--color-accent)]">tanmatra</code> · Pinned Astryx v0.1.8
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ModePreview mode="system" title="System Preference" />
        <ModePreview mode="light" title="Explicit Light Mode" />
        <ModePreview mode="dark" title="Explicit Dark Mode" />
      </div>
    </div>
  );
}
