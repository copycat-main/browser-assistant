import React, { useState, useCallback } from 'react';
import { useAgentStore } from './store/agentStore';
import Header from './components/Header';
import PromptInput from './components/PromptInput';
import ReasoningChain from './components/ReasoningChain';
import StatusBar from './components/StatusBar';
import SettingsPage from './components/SettingsPage';
import LandingPage from './components/LandingPage';
import ChatView from './components/ChatView';
import ResearchView from './components/ResearchView';

export default function App() {
  const currentView = useAgentStore((s) => s.currentView);
  const taskMode = useAgentStore((s) => s.taskMode);
  const status = useAgentStore((s) => s.status);
  const steps = useAgentStore((s) => s.steps);
  const chatMessages = useAgentStore((s) => s.chatMessages);
  const [prefillPrompt, setPrefillPrompt] = useState('');

  const handleSelectPrompt = useCallback((prompt: string) => {
    setPrefillPrompt(prompt);
  }, []);

  const handlePromptUsed = useCallback(() => {
    setPrefillPrompt('');
  }, []);

  if (currentView === 'settings') {
    return <SettingsPage />;
  }

  const hasContent = steps.length > 0 || chatMessages.length > 0 || status === 'running';
  const isAutomate = taskMode === 'automate';
  const isChat = taskMode === 'chat' || taskMode === 'extract';
  const isResearch = taskMode === 'research';

  const renderContent = () => {
    if (!hasContent) {
      return <LandingPage onSelectPrompt={handleSelectPrompt} />;
    }

    if (isAutomate) {
      return <ReasoningChain />;
    }

    if (isResearch) {
      return <ResearchView />;
    }

    if (isChat) {
      return <ChatView />;
    }

    // Fallback — show reasoning chain (automation steps) if we have steps
    if (steps.length > 0) {
      return <ReasoningChain />;
    }

    return <ChatView />;
  };

  return (
    <div className="flex flex-col h-screen bg-tan-50">
      <Header />
      {renderContent()}
      <div className="mt-auto">
        <StatusBar />
        <PromptInput prefillPrompt={prefillPrompt} onPromptUsed={handlePromptUsed} />
      </div>
    </div>
  );
}
