import React from 'react';
import { useAgentStore } from './store/agentStore';
import Header from './components/Header';
import PromptInput from './components/PromptInput';
import ReasoningChain from './components/ReasoningChain';
import StatusBar from './components/StatusBar';
import SettingsPage from './components/SettingsPage';

export default function App() {
  const currentView = useAgentStore((s) => s.currentView);

  if (currentView === 'settings') {
    return <SettingsPage />;
  }

  return (
    <div className="flex flex-col h-screen bg-tan-50">
      <Header />
      <ReasoningChain />
      <div className="mt-auto">
        <StatusBar />
        <PromptInput />
      </div>
    </div>
  );
}
