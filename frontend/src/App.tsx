import { useState } from "react";
import { useSyncSocket } from "./hooks/useSyncSocket";
import { Header } from "./components/Header";
import { PlayerCard } from "./components/PlayerCard";
import { LyricsView } from "./components/LyricsView";
import { DiscordPreview } from "./components/DiscordPreview";
import { SettingsModal } from "./components/SettingsModal";

export function App() {
  const {
    state,
    connected,
    toggleSync,
    setOffset,
    saveConfig,
    toggleDemo,
  } = useSyncSocket();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="app-container">
      <Header
        state={state}
        connected={connected}
        onToggleSync={toggleSync}
        onToggleDemo={toggleDemo}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="main-grid">
        {/* Left column: Player & Discord Preview */}
        <aside className="sidebar-column">
          <PlayerCard
            track={state.track}
            progressMs={state.progressMs}
            offsetMs={state.offsetMs}
            onSetOffset={setOffset}
          />

          <DiscordPreview
            statusText={state.activeLyricText}
            emojiName={state.statusEmoji}
            prefix={state.statusPrefix}
            isSyncing={state.isSyncing}
            throttled={state.discordThrottled}
            hasToken={Boolean(state.hasDiscordToken)}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        </aside>

        {/* Right column: Karaoke lyrics scroller */}
        <section style={{ height: "100%" }}>
          <LyricsView
            lyrics={state.lyrics}
            activeIndex={state.activeIndex}
            isSyncing={state.isSyncing}
          />
        </section>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentPrefix={state.statusPrefix}
        currentEmoji={state.statusEmoji}
        currentOffset={state.offsetMs}
        hasDiscordToken={Boolean(state.hasDiscordToken)}
        onSave={saveConfig}
      />
    </div>
  );
}

export default App;
