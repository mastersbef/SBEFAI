import React, { useState, useRef, useEffect } from 'react';
import { Message, Sender, VoiceSettings, Project } from './types';
import { sendMessageToGemini, generateImage } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import TypingIndicator from './components/TypingIndicator';

type Language = 'az' | 'tr' | 'en' | 'ru';
type View = 'chat' | 'projects' | 'preview';

const WELCOME_MESSAGES: Record<Language, string> = {
  az: 'SbefBOTV2 sistemdədir. Tural Alıyev tərəfindən yeniləndi. Eşidirəm səni, nə lazımdır?',
  tr: 'SbefBOTV2 devrede. Tural Alıyev tarafından güncellendi. Seni dinliyorum, ne yapalım?',
  en: 'SbefBOTV2 Online. Upgraded by Tural Aliyev. I am listening, how can I assist?',
  ru: 'SbefBOTV2 в сети. Обновлен Туралом Алыевым. Я слушаю, чем помочь?'
};

const PLACEHOLDERS: Record<Language, string> = {
  az: 'SbefBOTV2-ə yazın...',
  tr: 'SbefBOTV2 ile konuşun...',
  en: 'Message SbefBOTV2...',
  ru: 'Напишите SbefBOTV2...'
};

const SUGGESTIONS: Record<Language, string[]> = {
  az: ['Mənə lətifə danış', 'Bakının gəfləcək şəklini yarat', 'Portfolio saytı düzəlt (Figma style)', 'Həyatın mənası nədir?'],
  tr: ['Bana bir fıkra anlat', 'İstanbul resmi çiz', 'Modern bir cafe sitesi yap', 'Motivasyon sözü söyle'],
  en: ['Tell me a joke', 'Generate a futuristic image', 'Create a startup landing page', 'What is the meaning of life?'],
  ru: ['Расскажи шутку', 'Нарисуй будущее', 'Создай сайт для ресторана', 'В чем смысл жизни?']
};

const LANGUAGES = [
  { code: 'az', label: 'Azərbaycanca', flag: '🇦🇿' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' }
];

const App: React.FC = () => {
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  
  // Navigation & Projects State
  const [currentView, setCurrentView] = useState<View>('chat');
  const [projects, setProjects] = useState<Project[]>([]);
  const [previewCode, setPreviewCode] = useState<string>('');
  const [projectNameInput, setProjectNameInput] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Voice Settings
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    pitch: 1.0,
    rate: 1.1,
    voiceURI: null,
    autoRead: false
  });
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  // Admin Panel State
  const [adminInput, setAdminInput] = useState('');
  const [adminRole, setAdminRole] = useState<Sender>(Sender.BOT);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLanguageSelect = (lang: Language) => {
    setSelectedLanguage(lang);
    setMessages([
      {
        id: 'welcome',
        sender: Sender.BOT,
        text: WELCOME_MESSAGES[lang],
        timestamp: new Date(),
      }
    ]);
  };

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };
    
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const filteredVoices = availableVoices.filter(v => {
    if (!selectedLanguage) return false;
    const langCode = selectedLanguage === 'az' ? 'tr' : selectedLanguage; 
    return v.lang.toLowerCase().includes(langCode);
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, currentView]);

  useEffect(() => {
    let buffer = '';
    const handleKeyDown = (e: KeyboardEvent) => {
      buffer = (buffer + e.key).slice(-4).toLowerCase();
      if (buffer === 'sbef') {
        setShowMemory(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        setAttachment(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Sizin brauzeriniz səsli girişi dəstəkləmir.");
      return;
    }

    const recognition = new SpeechRecognition();
    
    const langCodeMap: Record<Language, string> = {
      az: 'az-AZ',
      tr: 'tr-TR',
      en: 'en-US',
      ru: 'ru-RU'
    };
    
    recognition.lang = selectedLanguage ? langCodeMap[selectedLanguage] : 'az-AZ';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event: any) => {
      const speechResult = event.results[0][0].transcript;
      setInputValue((prev) => prev + (prev ? ' ' : '') + speechResult);
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.start();
  };

  const isImageGenerationRequest = (text: string): boolean => {
    const lowerText = text.toLowerCase();
    const keywords = ['yarat', 'çək', 'hazırla', 'çiz', 'oluştur', 'tasarla', 'draw', 'generate', 'create', 'paint', 'нарисуй', 'создай'];
    const subjects = ['şəkil', 'foto', 'təsvir', 'mənzərə', 'resim', 'görüntü', 'fotoğraf', 'image', 'picture', 'photo', 'картинку', 'изображение'];
    return keywords.some(k => lowerText.includes(k)) && subjects.some(s => lowerText.includes(s));
  };

  const handleSendMessage = async (textOverride?: string) => {
    const textToSend = textOverride || inputValue.trim();
    if ((!textToSend && !attachment) || isLoading || !selectedLanguage) return;

    const currentAttachment = attachment;
    setInputValue('');
    setAttachment(null);

    const newUserMessage: Message = {
      id: Date.now().toString(),
      sender: Sender.USER,
      text: textToSend,
      timestamp: new Date(),
      attachment: currentAttachment || undefined
    };

    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      const langMap: Record<Language, string> = {
        az: "Azərbaycan dili",
        tr: "Türkçe",
        en: "English",
        ru: "Русский язык"
      };

      if (isImageGenerationRequest(textToSend) && !currentAttachment) {
        const imageBytes = await generateImage(textToSend);
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          sender: Sender.BOT,
          text: 'Buyur, istədiyin o mükəmməl təsvir:',
          timestamp: new Date(),
          attachment: imageBytes
        };
        setMessages(prev => [...prev, botMessage]);
      } else {
        const responseText = await sendMessageToGemini(
          [...messages, newUserMessage], 
          textToSend, 
          currentAttachment,
          langMap[selectedLanguage]
        );
        
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          sender: Sender.BOT,
          text: responseText,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);
      }
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: Sender.BOT,
        text: error.message || "Sistem xətası.",
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handlePreview = (code: string) => {
    setPreviewCode(code);
    setCurrentView('preview');
  };

  const saveProject = () => {
    if (!projectNameInput.trim()) return;
    const newProject: Project = {
      id: Date.now().toString(),
      name: projectNameInput,
      code: previewCode,
      createdAt: new Date()
    };
    setProjects(prev => [newProject, ...prev]);
    setShowSaveDialog(false);
    setProjectNameInput('');
    alert("Project Saved to Library!");
  };

  const loadProject = (project: Project) => {
    setPreviewCode(project.code);
    setCurrentView('preview');
  };

  const deleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  // --- Sub-Renderers ---

  const renderChat = () => (
    <>
      <main className="relative z-10 flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth pb-32">
        <div className="max-w-4xl mx-auto space-y-8">
          {messages.map((msg, idx) => (
            <ChatMessage 
              key={msg.id} 
              message={msg} 
              language={selectedLanguage!} 
              voiceSettings={voiceSettings} 
              isLatest={idx === messages.length - 1}
              onPreview={handlePreview}
            />
          ))}
          {isLoading && (
            <div className="flex justify-start animate-slide-up">
               <div className="flex items-end gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white shadow-lg animate-pulse">V2</div>
                  <div className="flex items-center gap-2 text-cyan-500 text-xs font-mono animate-pulse">
                    <span>ANALYZING_INPUT</span>
                    <TypingIndicator />
                  </div>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="relative z-10 p-4 glass-panel border-t border-white/5">
        <div className="max-w-4xl mx-auto relative flex flex-col gap-4">
          
          {/* Suggestions */}
          {messages.length < 3 && !isLoading && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none mask-image-fade">
              {SUGGESTIONS[selectedLanguage!].map((sug, idx) => (
                <button 
                  key={idx}
                  onClick={() => handleSendMessage(sug)}
                  className="whitespace-nowrap px-4 py-2 bg-[#0f172a]/80 border border-cyan-900/30 rounded-full text-xs text-cyan-300/80 hover:bg-cyan-900/20 hover:text-cyan-300 hover:border-cyan-500/50 transition-all active:scale-95"
                >
                  {sug}
                </button>
              ))}
            </div>
          )}

          {/* Attachment Preview */}
          {attachment && (
             <div className="relative w-fit animate-slide-up">
               <img 
                  src={`data:image/jpeg;base64,${attachment}`} 
                  alt="Preview" 
                  className="h-24 w-24 object-cover rounded-xl border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]" 
               />
               <button 
                 onClick={() => setAttachment(null)}
                 className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs shadow-md hover:bg-red-600 transition-colors border-2 border-[#020408]"
               >
                 ✕
               </button>
             </div>
          )}

          <div className="relative flex items-end gap-3">
             <input 
               type="file" 
               ref={fileInputRef} 
               accept="image/*" 
               className="hidden" 
               onChange={handleFileChange}
             />
             <button 
               onClick={() => fileInputRef.current?.click()}
               className={`p-4 rounded-2xl transition-all active:scale-95 shadow-lg border
                  ${attachment ? 'bg-cyan-900/30 text-cyan-400 border-cyan-500/50 shadow-cyan-500/10' : 'bg-[#0f172a] text-gray-400 border-white/5 hover:text-cyan-400 hover:bg-[#1e293b] hover:border-cyan-500/30'}
               `}
               title="Görmə qabiliyyəti (Şəkil)"
             >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clipRule="evenodd" />
                </svg>
             </button>

             <div className="relative flex-1 group">
                <div className={`absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl blur opacity-0 group-hover:opacity-20 transition duration-1000 group-focus-within:opacity-40 ${isListening ? 'opacity-50 bg-gradient-to-r from-red-500 to-orange-500' : ''}`}></div>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={isListening ? "Listening..." : PLACEHOLDERS[selectedLanguage!]}
                  className={`relative w-full bg-[#0b101e] text-white placeholder-gray-600 rounded-2xl pl-6 pr-24 py-4 focus:outline-none focus:bg-[#111827] transition-all shadow-inner border border-white/5 ${isListening ? 'text-red-200 placeholder-red-400' : ''}`}
                />
                
                <button 
                  onClick={toggleListening}
                  className={`absolute right-14 top-2 bottom-2 w-10 flex items-center justify-center rounded-xl transition-all
                    ${isListening ? 'text-red-500 animate-pulse bg-red-950/30' : 'text-gray-500 hover:text-cyan-400 hover:bg-white/5'}
                  `}
                  title="Səsli əmr"
                >
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                     <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                     <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
                   </svg>
                </button>

                <button
                  onClick={() => handleSendMessage()}
                  disabled={(!inputValue.trim() && !attachment) || isLoading}
                  className="absolute right-2 top-2 bottom-2 w-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg hover:shadow-cyan-500/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 group-disabled:hover:shadow-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                  </svg>
                </button>
             </div>
          </div>
        </div>
      </footer>
    </>
  );

  const renderPreview = () => (
    <div className="flex flex-col h-full bg-[#020408]">
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#0a0f1d]">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentView('chat')} className="text-gray-400 hover:text-white flex items-center gap-2">
            <span>←</span> Back to Chat
          </button>
          <h2 className="text-cyan-400 font-cyber font-bold">PROJECT PREVIEW MODE</h2>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowSaveDialog(true)} 
            className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-cyan-500/20"
          >
            SAVE PROJECT
          </button>
        </div>
      </div>
      <div className="flex-1 bg-white relative">
         <iframe 
           srcDoc={previewCode}
           className="w-full h-full border-none"
           title="Preview"
           sandbox="allow-scripts"
         />
      </div>
      
      {showSaveDialog && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#0f172a] p-6 rounded-xl border border-cyan-500/30 w-80 space-y-4">
             <h3 className="text-white font-bold">Save Project</h3>
             <input 
               type="text" 
               placeholder="Project Name..." 
               value={projectNameInput}
               onChange={(e) => setProjectNameInput(e.target.value)}
               className="w-full bg-black/50 border border-white/10 rounded p-2 text-white focus:border-cyan-500 outline-none"
             />
             <div className="flex justify-end gap-2">
               <button onClick={() => setShowSaveDialog(false)} className="text-gray-400 px-3 py-1">Cancel</button>
               <button onClick={saveProject} className="bg-cyan-600 text-white px-4 py-1 rounded">Save</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderProjects = () => (
    <div className="flex flex-col h-full p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setCurrentView('chat')} className="text-gray-400 hover:text-white">← Back</button>
          <h2 className="text-2xl font-cyber text-white">MY PROJECT LIBRARY</h2>
        </div>
        
        {projects.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl">
             <p className="text-gray-500 mb-4">No saved projects yet.</p>
             <button onClick={() => setCurrentView('chat')} className="text-cyan-400 hover:underline">Ask SbefBOTV2 to create a website!</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {projects.map(p => (
               <div key={p.id} className="bg-[#0f172a] border border-white/5 rounded-xl overflow-hidden hover:border-cyan-500/50 transition-all group">
                  <div className="h-32 bg-gradient-to-br from-gray-800 to-black flex items-center justify-center text-gray-600 font-mono text-xs p-4">
                     HTML PREVIEW
                  </div>
                  <div className="p-4">
                     <h3 className="text-white font-bold truncate">{p.name}</h3>
                     <p className="text-gray-500 text-xs mb-4">{p.createdAt.toLocaleDateString()}</p>
                     <div className="flex gap-2">
                       <button onClick={() => loadProject(p)} className="flex-1 bg-cyan-900/30 text-cyan-400 py-2 rounded hover:bg-cyan-900/50">Open</button>
                       <button onClick={() => deleteProject(p.id)} className="px-3 bg-red-900/20 text-red-400 rounded hover:bg-red-900/40">✕</button>
                     </div>
                  </div>
               </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );

  if (!selectedLanguage) {
    return (
      <div className="relative flex flex-col h-screen bg-[#020408] text-white overflow-hidden font-['Outfit'] items-center justify-center">
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
           <div className="absolute top-[-20%] left-[-10%] w-[700px] h-[700px] bg-cyan-900/10 rounded-full blur-[120px] animate-float"></div>
           <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[120px] animate-float-delayed"></div>
        </div>

        <div className="relative z-10 p-10 glass-panel rounded-3xl border border-cyan-500/20 max-w-md w-full shadow-[0_0_50px_rgba(6,182,212,0.1)] animate-slide-up">
          <div className="text-center mb-10">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.4)] relative group">
               <div className="absolute inset-0 bg-cyan-400 blur-lg opacity-40 group-hover:opacity-70 transition-opacity"></div>
               <span className="font-bold text-white text-3xl relative z-10 font-cyber">V2</span>
            </div>
            <h1 className="text-3xl font-bold tracking-widest mb-2 font-cyber text-glow">SbefBOT<span className="text-cyan-400">V2</span></h1>
            <p className="text-[10px] text-cyan-500/70 uppercase tracking-[0.3em]">Tural Alıyev AI Systems</p>
          </div>

          <div className="space-y-3">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageSelect(lang.code as Language)}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-[#0a0f1d] border border-white/5 hover:border-cyan-500/50 hover:bg-cyan-950/20 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all duration-300 group active:scale-95"
              >
                <span className="font-medium text-gray-300 group-hover:text-cyan-300 transition-colors">{lang.label}</span>
                <span className="text-xl filter grayscale group-hover:grayscale-0 transition-all scale-110">{lang.flag}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-screen bg-[#020408] text-white overflow-hidden font-['Outfit'] selection:bg-cyan-500/30">
      
      {/* Background (Only for chat/projects) */}
      {currentView !== 'preview' && (
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-purple-900/10 rounded-full blur-[100px] animate-float"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-cyan-900/10 rounded-full blur-[100px] animate-float-delayed"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
        </div>
      )}

      {/* Header (Visible unless preview) */}
      {currentView !== 'preview' && (
        <header className="relative z-10 flex items-center justify-between px-6 py-4 glass-panel border-b border-white/5 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)] relative overflow-hidden">
              <div className="absolute inset-0 bg-white/10 skew-x-12 translate-x-[-100%] animate-[shimmer_3s_infinite]"></div>
              <span className="font-bold text-white text-lg font-cyber">V2</span>
            </div>
            <div>
              <h1 className="font-bold text-xl tracking-wide font-cyber">SbefBOT<span className="text-cyan-400 text-glow">V2</span></h1>
              <p className="text-[10px] text-gray-400 font-light tracking-wider">Created by <span className="text-cyan-500 font-bold">Tural Alıyev</span></p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setCurrentView('projects')}
              className={`p-2 rounded bg-[#0a0f1d] border border-white/10 transition-all ${currentView === 'projects' ? 'text-cyan-400 border-cyan-500' : 'text-gray-400 hover:text-cyan-400 hover:border-cyan-500/50'}`}
              title="Layihələr (Projects)"
            >
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
               </svg>
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 rounded bg-[#0a0f1d] border border-white/10 text-gray-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-all"
              title="Ayarlar"
            >
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.45-.083a7.49 7.49 0 00-.985-.57c-.182-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
               </svg>
            </button>
          </div>
        </header>
      )}

      {/* Main Content Views */}
      {currentView === 'chat' && renderChat()}
      {currentView === 'projects' && renderProjects()}
      {currentView === 'preview' && renderPreview()}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
           <div className="bg-[#0a0f1d] w-full max-w-md rounded-2xl border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.15)] p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                 <h3 className="font-cyber text-xl text-white flex items-center gap-2">
                    <span className="text-cyan-400">V2</span> AUDIO CONFIG
                 </h3>
                 <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-white transition-colors">✕</button>
              </div>
              
              <div className="space-y-6">
                {/* Auto Read Toggle */}
                <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg">
                   <span className="text-sm font-bold text-gray-300">Auto-Read Messages</span>
                   <button 
                     onClick={() => setVoiceSettings(prev => ({...prev, autoRead: !prev.autoRead}))}
                     className={`w-12 h-6 rounded-full relative transition-colors ${voiceSettings.autoRead ? 'bg-cyan-500' : 'bg-gray-700'}`}
                   >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${voiceSettings.autoRead ? 'left-7' : 'left-1'}`}></div>
                   </button>
                </div>

                {/* Voice Selection */}
                <div className="space-y-2">
                   <label className="text-xs text-cyan-500 uppercase tracking-wider font-bold">Voice Module</label>
                   <select 
                      value={voiceSettings.voiceURI || ''}
                      onChange={(e) => setVoiceSettings({...voiceSettings, voiceURI: e.target.value})}
                      className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm text-gray-300 focus:border-cyan-500 outline-none"
                   >
                      <option value="">Auto-Detect (Default)</option>
                      {filteredVoices.map(v => (
                        <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
                      ))}
                   </select>
                </div>

                {/* Speed Slider */}
                <div className="space-y-2">
                   <div className="flex justify-between text-xs">
                      <label className="text-cyan-500 uppercase tracking-wider font-bold">Speed Rate</label>
                      <span className="text-gray-400">{voiceSettings.rate.toFixed(1)}x</span>
                   </div>
                   <input 
                     type="range" 
                     min="0.5" 
                     max="2" 
                     step="0.1" 
                     value={voiceSettings.rate}
                     onChange={(e) => setVoiceSettings({...voiceSettings, rate: parseFloat(e.target.value)})}
                     className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                   />
                </div>

                {/* Pitch Slider */}
                <div className="space-y-2">
                   <div className="flex justify-between text-xs">
                      <label className="text-cyan-500 uppercase tracking-wider font-bold">Pitch Level</label>
                      <span className="text-gray-400">{voiceSettings.pitch.toFixed(1)}</span>
                   </div>
                   <input 
                     type="range" 
                     min="0.5" 
                     max="2" 
                     step="0.1" 
                     value={voiceSettings.pitch}
                     onChange={(e) => setVoiceSettings({...voiceSettings, pitch: parseFloat(e.target.value)})}
                     className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                   />
                </div>
              </div>
           </div>
        </div>
      )}

      {/* Admin Panel (Code Hidden for brevity, same as previous but ensures consistency) */}
      {showMemory && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 font-mono" onClick={() => setShowMemory(false)}>
           {/* ... (Admin Panel Content Preserved) ... */}
           <div className="w-full max-w-2xl border border-cyan-500/50 bg-black/80 p-6 rounded-lg relative overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <h2 className="text-cyan-400 text-xl font-bold uppercase font-cyber mb-4">V2 KERNEL ACCESS</h2>
               <div className="flex-1 overflow-y-auto bg-black/50 p-4 border border-white/10 text-xs text-green-500">
                  {messages.map(m => (
                     <div key={m.id} className="mb-2 border-b border-white/5 pb-1">
                        <span className="text-purple-400">[{m.sender}]</span>: {m.text.substring(0, 50)}...
                     </div>
                  ))}
               </div>
               <div className="mt-4 flex gap-2">
                  <input className="flex-1 bg-black border border-cyan-500 p-2 text-white text-xs" value={adminInput} onChange={e => setAdminInput(e.target.value)} placeholder="INJECT DATA..." />
                  <button className="bg-cyan-900 text-cyan-400 px-4 py-2 text-xs font-bold">EXECUTE</button>
               </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;