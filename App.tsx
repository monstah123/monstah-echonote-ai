
import React, { useState, useCallback, useEffect } from 'react';
import { AppView, Note, UserStats } from './types';
import BottomNav from './components/BottomNav';
import Home from './components/Home';
import NotesView from './components/NotesView';
import ChatView from './components/ChatView';
import MyFilesView from './components/MyFilesView';
import ScannerView from './components/ScannerView';
import { AlertTriangle } from 'lucide-react';
import { transcribeAudioFile, scanImageForText } from './services/openaiService';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// --- Delete Confirmation Modal Component ---
interface DeleteConfirmationModalProps {
  note: Note;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({ note, onConfirm, onCancel }) => {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      <div className="bg-light-card dark:bg-dark-card rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-fade-in">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50 mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">Delete Note</h3>
        <div className="mt-2 text-sm text-light-text-secondary dark:dark-text-secondary">
          <p>Are you sure you want to delete this note?</p>
          <p className="font-medium truncate mt-1">"{note.title}"</p>
          <p className="mt-2">This action cannot be undone.</p>
        </div>
        <div className="mt-6 flex justify-center gap-4">
          <button
            type="button"
            className="flex-1 rounded-md bg-gray-200 dark:bg-slate-700 px-4 py-2 text-sm font-semibold text-light-text dark:text-dark-text shadow-sm hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 transition-colors"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};


const LOCAL_STORAGE_KEY = 'echonote-ai-notes';

// Helper to convert a file to a base64 string
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};


const App: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [currentView, setCurrentView] = useState<AppView>(AppView.Home);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);

  const [notes, setNotes] = useState<Note[]>(() => {
    try {
      const savedNotes = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedNotes) {
        return (JSON.parse(savedNotes) as Note[]).map(note => ({
          ...note,
          createdAt: new Date(note.createdAt),
        }));
      }
    } catch (error) {
      console.error('Failed to load notes from localStorage', error);
    }
    return [];
  });

  const [activeNote, setActiveNote] = useState<Note | null>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.5.136/build/pdf.worker.mjs`;
  }, [isDarkMode]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notes));
    } catch (error) {
      console.error('Failed to save notes to localStorage', error);
    }
  }, [notes]);

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  }, []);

  const handleBackToMyFiles = () => {
    setActiveNote(null);
    setCurrentView(AppView.MyFiles);
  };

  const handleBackToNotes = () => {
    setCurrentView(AppView.Notes);
  };

  const handleStartScan = () => {
    setShouldAutoPlay(true);
    setCurrentView(AppView.Scanner);
  };

  const handleCapture = async (base64Data: string) => {
    setCurrentView(AppView.Notes); // Go to notes first to show loading
    const tempNote = createAndActivateNote(`Scan ${new Date().toLocaleTimeString()}`, "[Scanning image...]");

    try {
      const transcript = await scanImageForText(base64Data, 'image/jpeg');

      const updateNoteState = (noteToUpdate: Note, newTranscript: string) => ({ ...noteToUpdate, transcript: newTranscript });

      setNotes(prevNotes => prevNotes.map(n => n.id === tempNote.id ? updateNoteState(n, transcript) : n));
      setActiveNote(currentActiveNote => currentActiveNote?.id === tempNote.id ? updateNoteState(currentActiveNote, transcript) : currentActiveNote);
      showToast("Scan complete!");

      // We'll leave auto-play handling to the NotesView for now or 
      // we could potentially add an 'autoPlay' property to activeNote state.
    } catch (error) {
      console.error("Scan error:", error);
      const errorMessage = "[Error scanning image. Please try again.]";
      setNotes(prevNotes => prevNotes.map(n => n.id === tempNote.id ? { ...n, transcript: errorMessage } : n));
      setActiveNote(currentActiveNote => currentActiveNote?.id === tempNote.id ? { ...currentActiveNote, transcript: errorMessage } : currentActiveNote);
      showToast("Scan failed.");
    }
  };

  const handleSelectNote = (note: Note) => {
    setActiveNote(note);
    setCurrentView(AppView.Notes);
  };

  const requestDeleteNote = (noteId: number) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      setNoteToDelete(note);
    }
  };

  const confirmDeleteNote = () => {
    if (!noteToDelete) return;
    setNotes(prev => prev.filter(n => n.id !== noteToDelete.id));
    if (activeNote?.id === noteToDelete.id) {
      setActiveNote(null);
      setCurrentView(AppView.MyFiles);
    }
    showToast(`Note "${noteToDelete.title}" deleted.`);
    setNoteToDelete(null);
  };

  const cancelDeleteNote = () => {
    setNoteToDelete(null);
  };


  const createAndActivateNote = useCallback((title: string, transcript: string): Note => {
    const newNote: Note = {
      id: Date.now(),
      title: title,
      transcript: transcript,
      summary: '',
      createdAt: new Date(),
    };
    setNotes(prev => [newNote, ...prev]);
    setActiveNote(newNote);
    setCurrentView(AppView.Notes);
    return newNote;
  }, []);

  const startNewNote = useCallback(() => {
    createAndActivateNote(`Note ${new Date().toLocaleDateString()}`, '');
  }, [createAndActivateNote]);

  const saveNote = useCallback((noteToSave: Note) => {
    setNotes(prevNotes => {
      const existingIndex = prevNotes.findIndex(n => n.id === noteToSave.id);
      if (existingIndex > -1) {
        const updatedNotes = [...prevNotes];
        updatedNotes[existingIndex] = noteToSave;
        return updatedNotes;
      }
      return [noteToSave, ...prevNotes];
    });
    if (activeNote?.id === noteToSave.id) {
      setActiveNote(noteToSave);
    }
  }, [activeNote]);

  const navigateToChat = useCallback((note: Note) => {
    setActiveNote(note);
    setCurrentView(AppView.Chat);
  }, []);

  const handleFileImport = useCallback(async (file: File) => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
    const textExtensions = ['txt', 'md'];
    const docExtensions = ['pdf', 'doc', 'docx'];
    const mediaExtensions = ['mp3', 'wav', 'mp4', 'm4a', 'webm'];
    const scanExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

    if (textExtensions.includes(fileExtension) || file.type.startsWith('text/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const textContent = e.target?.result as string;
        createAndActivateNote(file.name, textContent);
      };
      reader.onerror = () => showToast("Sorry, there was an error reading the file.");
      reader.readAsText(file);
    }
    else if (mediaExtensions.includes(fileExtension) || file.type.startsWith('audio/') || file.type.startsWith('video/')) {
      const tempNote = createAndActivateNote(file.name, `[Transcribing ${file.name}...]`);

      try {
        const base64Data = await fileToBase64(file);
        const transcript = await transcribeAudioFile(base64Data, file.type);

        const updateNoteState = (noteToUpdate: Note, newTranscript: string) => ({ ...noteToUpdate, transcript: newTranscript });

        setNotes(prevNotes => prevNotes.map(n => n.id === tempNote.id ? updateNoteState(n, transcript) : n));
        setActiveNote(currentActiveNote => currentActiveNote?.id === tempNote.id ? updateNoteState(currentActiveNote, transcript) : currentActiveNote);
        showToast("Transcription complete!");
      } catch (error) {
        console.error("File processing error:", error);
        const errorMessage = `[Error transcribing ${file.name}. Please try again.]`;
        setNotes(prevNotes => prevNotes.map(n => n.id === tempNote.id ? { ...n, transcript: errorMessage } : n));
        setActiveNote(currentActiveNote => currentActiveNote?.id === tempNote.id ? { ...currentActiveNote, transcript: errorMessage } : currentActiveNote);
        showToast("Transcription failed.");
      }
    }
    else if (docExtensions.includes(fileExtension)) {
      if (fileExtension === 'pdf') {
        const tempNote = createAndActivateNote(file.name, `[Extracting text from ${file.name}...]`);
        try {
          const arrayBuffer = await file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument(arrayBuffer);
          const pdf = await loadingTask.promise;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => (item as any).str).join(' ');
            fullText += pageText + '\n\n';
          }

          const updateNoteState = (noteToUpdate: Note, newTranscript: string) => ({ ...noteToUpdate, transcript: newTranscript });
          setNotes(prevNotes => prevNotes.map(n => n.id === tempNote.id ? updateNoteState(n, fullText.trim()) : n));
          setActiveNote(currentActiveNote => currentActiveNote?.id === tempNote.id ? updateNoteState(currentActiveNote, fullText.trim()) : currentActiveNote);
          showToast("Text extracted from PDF!");

        } catch (error) {
          console.error("PDF processing error:", error);
          const errorMessage = `[Error extracting text from ${file.name}. The file might be corrupt or protected.]`;
          setNotes(prevNotes => prevNotes.map(n => n.id === tempNote.id ? { ...n, transcript: errorMessage } : n));
          setActiveNote(currentActiveNote => currentActiveNote?.id === tempNote.id ? { ...currentActiveNote, transcript: errorMessage } : currentActiveNote);
          showToast("PDF text extraction failed.");
        }
      } else if (fileExtension === 'docx') {
        const tempNote = createAndActivateNote(file.name, `[Extracting text from ${file.name}...]`);
        try {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          const docxText = result.value;

          const updateNoteState = (noteToUpdate: Note, newTranscript: string) => ({ ...noteToUpdate, transcript: newTranscript });
          setNotes(prevNotes => prevNotes.map(n => n.id === tempNote.id ? updateNoteState(n, docxText.trim()) : n));
          setActiveNote(currentActiveNote => currentActiveNote?.id === tempNote.id ? updateNoteState(currentActiveNote, docxText.trim()) : currentActiveNote);
          showToast("Text extracted from DOCX!");

        } catch (error) {
          console.error("DOCX processing error:", error);
          const errorMessage = `[Error extracting text from ${file.name}. The file might be corrupt.]`;
          setNotes(prevNotes => prevNotes.map(n => n.id === tempNote.id ? { ...n, transcript: errorMessage } : n));
          setActiveNote(currentActiveNote => currentActiveNote?.id === tempNote.id ? { ...currentActiveNote, transcript: errorMessage } : currentActiveNote);
          showToast("DOCX text extraction failed.");
        }
      } else {
        createAndActivateNote(
          file.name,
          `[File type (${fileExtension}) is not supported for automatic text extraction. Please copy and paste the content manually.]`
        );
      }
    }
    else if (scanExtensions.includes(fileExtension) || file.type.startsWith('image/')) {
      const tempNote = createAndActivateNote(file.name, `[Scanning ${file.name}...]`);
      try {
        const base64Data = await fileToBase64(file);
        const extractedText = await scanImageForText(base64Data, file.type);

        const updateNoteState = (noteToUpdate: Note, newTranscript: string) => ({ ...noteToUpdate, transcript: newTranscript });

        setNotes(prevNotes => prevNotes.map(n => n.id === tempNote.id ? updateNoteState(n, extractedText) : n));
        setActiveNote(currentActiveNote => currentActiveNote?.id === tempNote.id ? updateNoteState(currentActiveNote, extractedText) : currentActiveNote);
        showToast("Scan complete!");
      } catch (error) {
        console.error("Scan error:", error);
        const errorMessage = `[Error scanning ${file.name}. Please try again.]`;
        setNotes(prevNotes => prevNotes.map(n => n.id === tempNote.id ? { ...n, transcript: errorMessage } : n));
        setActiveNote(currentActiveNote => currentActiveNote?.id === tempNote.id ? { ...currentActiveNote, transcript: errorMessage } : currentActiveNote);
        showToast("Scan failed.");
      }
    }
    else {
      showToast("Unsupported file type.");
    }
  }, [showToast]);


  // Track last opened note for "Continue Listening" feature
  const [lastOpenedNoteId, setLastOpenedNoteId] = useState<number | null>(null);

  useEffect(() => {
    if (activeNote) {
      setLastOpenedNoteId(activeNote.id);
      localStorage.setItem('LAST_OPENED_NOTE_ID', activeNote.id.toString());
    }
  }, [activeNote]);

  useEffect(() => {
    const savedId = localStorage.getItem('LAST_OPENED_NOTE_ID');
    if (savedId) {
      setLastOpenedNoteId(parseInt(savedId));
    }
  }, []);

  const recentNote = notes.find(n => n.id === lastOpenedNoteId);

  // Stats Logic
  const helperGetInitialStats = (): UserStats => {
    try {
      const saved = localStorage.getItem('USER_STATS');
      if (saved) return JSON.parse(saved);
    } catch (e) { console.error("Stats parse error", e); }
    return {
      totalTimeSavedMs: 0,
      dailyListeningTimeMs: 0,
      averageSpeed: 1.0,
      dailyGoalMs: 40 * 60 * 1000,
      lastUpdatedDate: new Date().toDateString()
    };
  };

  const [userStats, setUserStats] = useState<UserStats>(helperGetInitialStats);

  // Handle stats updates from components
  const handleStatsUpdate = useCallback((realTimeMs: number, savedTimeMs: number) => {
    console.log(`Stats Update: ${realTimeMs}ms listened, ${savedTimeMs}ms saved`);
    setUserStats(prev => {
      const today = new Date().toDateString();
      const isNewDay = today !== prev.lastUpdatedDate;

      const newDaily = isNewDay ? realTimeMs : prev.dailyListeningTimeMs + realTimeMs;
      const newTotalSaved = prev.totalTimeSavedMs + savedTimeMs;

      // Simple moving average for speed (new chunk weight 10%)
      const chunkSpeed = (realTimeMs > 0) ? (savedTimeMs / realTimeMs) + 1 : 1;
      // Avoid NaN or Infinity
      const validChunkSpeed = isFinite(chunkSpeed) ? chunkSpeed : 1.0;
      const newAvgSpeed = prev.averageSpeed * 0.9 + validChunkSpeed * 0.1;

      const newStats = {
        totalTimeSavedMs: newTotalSaved,
        dailyListeningTimeMs: newDaily,
        dailyGoalMs: prev.dailyGoalMs,
        averageSpeed: newAvgSpeed,
        lastUpdatedDate: today
      };
      localStorage.setItem('USER_STATS', JSON.stringify(newStats));
      return newStats;
    });
  }, []);

  const renderView = () => {
    switch (currentView) {
      case AppView.Home:
        return <Home isDarkMode={isDarkMode} onNewNote={startNewNote} toggleTheme={toggleTheme} onFileImport={handleFileImport} onStartScan={handleStartScan} recentNote={recentNote} onOpenNote={handleSelectNote} userStats={userStats} />;
      case AppView.Scanner:
        return <ScannerView onCapture={handleCapture} onClose={() => { setShouldAutoPlay(false); setCurrentView(AppView.Home); }} />;
      case AppView.MyFiles:
        return <MyFilesView notes={notes} onSelectNote={handleSelectNote} onRequestDelete={requestDeleteNote} onNewNote={startNewNote} />;
      case AppView.Notes:
        return <NotesView note={activeNote} onSave={saveNote} onStartChat={navigateToChat} onBack={handleBackToMyFiles} showToast={showToast} shouldAutoPlay={shouldAutoPlay} onStatsUpdate={handleStatsUpdate} />;
      case AppView.Chat:
        return <ChatView note={activeNote} onBack={handleBackToNotes} />;
      default:
        return <Home isDarkMode={isDarkMode} onNewNote={startNewNote} toggleTheme={toggleTheme} onFileImport={handleFileImport} recentNote={recentNote} onOpenNote={handleSelectNote} userStats={userStats} />;
    }
  };

  const handleNavChange = (view: AppView) => {
    setShouldAutoPlay(false);
    if ((currentView === AppView.Notes || currentView === AppView.Chat) && view === AppView.MyFiles) {
      setActiveNote(null);
    }
    setCurrentView(view);
  };

  return (
    <div className={`font-sans min-h-screen ${isDarkMode ? 'dark' : ''} bg-light-bg dark:bg-dark-bg text-light-text dark:dark-text transition-colors duration-300 flex items-center justify-center p-2`}>
      <div className="app-glow-wrapper w-full max-w-md">
        <div className="breathing-border bg-light-bg dark:bg-dark-bg h-[calc(100vh-16px)] flex flex-col relative overflow-hidden">
          <main className="flex-1 overflow-hidden relative pb-20">
            {renderView()}
          </main>
          <BottomNav currentView={currentView} setCurrentView={handleNavChange} onNewNote={startNewNote} />

          {toastMessage && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-gradient-to-r from-brand-blue to-purple-600 text-white font-semibold py-3 px-6 rounded-full shadow-xl z-50 animate-fade-in-out border border-purple-400/30">
              {toastMessage}
            </div>
          )}

          {noteToDelete && (
            <DeleteConfirmationModal
              note={noteToDelete}
              onConfirm={confirmDeleteNote}
              onCancel={cancelDeleteNote}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
