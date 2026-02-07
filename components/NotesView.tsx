
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Note } from '../types';
import { summarizeTranscript, generateSpeechFromText, transcribeAudioFile, OPENAI_VOICES } from '../services/openaiService';
import { Mic, StopCircle, Loader, FileText, Send, ArrowLeft, Download, UploadCloud, Check, Pause, ChevronDown, Play } from 'lucide-react';

interface NotesViewProps {
  note: Note | null;
  onSave: (note: Note) => void;
  onStartChat: (note: Note) => void;
  onBack: () => void;
  showToast: (message: string) => void;
  shouldAutoPlay?: boolean;
}

// --- Audio Helper Functions ---

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to decode MP3 audio data using Web Audio API
async function decodeAudioDataFromMp3(
  data: Uint8Array,
  ctx: AudioContext,
): Promise<AudioBuffer> {
  const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  return await ctx.decodeAudioData(arrayBuffer);
}

// Use OpenAI voices instead of Gemini voices
const voices = OPENAI_VOICES;

// Play a notification sound (pleasant chime)
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Create two oscillators for a pleasant two-tone chime
    const playTone = (frequency: number, startTime: number, duration: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      // Fade in and out for a smooth sound
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    const now = audioContext.currentTime;
    playTone(523.25, now, 0.15);        // C5
    playTone(659.25, now + 0.1, 0.2);   // E5
    playTone(783.99, now + 0.2, 0.25);  // G5

    // Clean up after sounds complete
    setTimeout(() => audioContext.close(), 1000);
  } catch (e) {
    console.log('Could not play notification sound:', e);
  }
}

const playbackSpeeds = [0.75, 1, 1.25, 1.5, 2];

interface AudioWaveformVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
}

const AudioWaveformVisualizer: React.FC<AudioWaveformVisualizerProps> = ({ analyser, isPlaying }) => {
  const [dataArray, setDataArray] = useState<Uint8Array | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (analyser) {
      const bufferLength = analyser.frequencyBinCount;
      setDataArray(new Uint8Array(bufferLength));
    }
  }, [analyser]);

  const draw = useCallback(() => {
    if (!analyser || !dataArray) return;

    animationFrameIdRef.current = requestAnimationFrame(draw);
    const currentData = dataArray;
    const newData = new Uint8Array(currentData.length);
    analyser.getByteFrequencyData(newData);
    setDataArray(newData);
  }, [analyser, dataArray]);

  useEffect(() => {
    if (isPlaying && analyser) {
      draw();
    } else {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    }

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [isPlaying, analyser, draw]);

  if (!dataArray) return null;

  const currentData = dataArray;
  const barWidthPercent = 100 / currentData.length;
  const gapPercent = barWidthPercent * 0.15;
  const rectWidthPercent = barWidthPercent - gapPercent;

  return (
    <svg width="100%" height="40" preserveAspectRatio="none">
      {Array.from(currentData).map((value: number, i: number) => {
        const height = (value / 255) * 40;
        return (
          <rect
            key={i}
            x={`${i * barWidthPercent}%`}
            y={40 - height}
            width={`${rectWidthPercent}%`}
            height={height}
            className="text-brand-blue"
            fill="currentColor"
            rx="1"
          />
        );
      })}
    </svg>
  );
};


const NotesView: React.FC<NotesViewProps> = ({ note, onSave, onStartChat, onBack, showToast, shouldAutoPlay }) => {
  const [currentNote, setCurrentNote] = useState<Note | null>(note);
  const [isRecording, setIsRecording] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [driveSaveState, setDriveSaveState] = useState<'idle' | 'saving' | 'success'>('idle');
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('alloy');
  const [isVoiceDropdownOpen, setIsVoiceDropdownOpen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [hasAutoPlayed, setHasAutoPlayed] = useState(false);
  const [showPlayPrompt, setShowPlayPrompt] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Use HTMLAudioElement for better compatibility with Safari/Mobile
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null); // Cache the blob URL
  const lastPlayedTextRef = useRef<string>('');    // Cache the text to verify reuse

  // Refs for visualiser/cleanup (kept for reference or potential future use)
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const audioSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const voiceDropdownRef = useRef<HTMLDivElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  // audioBufferRef is replaced by direct Audio element src, but we might check if we need it for anything else. 
  // If not, removing it is safer. 
  // Checking usage: handleSelectVoice used it (fixed), Stop button used it (need to fix).

  const cleanupAudio = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = '';
      audioElementRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    lastPlayedTextRef.current = '';

    // Clean up AudioContext if used for visualiser (optional, skipping for now to ensure stability)
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
      outputAudioContextRef.current.close();
    }
    outputAudioContextRef.current = null;
    analyserRef.current = null;
    setIsPlayingAudio(false);
    setIsGeneratingSpeech(false);
  }, []);

  // Auto-play effect - triggers when shouldAutoPlay is true (e.g., after scanning)
  useEffect(() => {
    if (shouldAutoPlay && !hasAutoPlayed && currentNote?.transcript && currentNote.transcript.trim().length > 0 && !currentNote.transcript.startsWith('[')) {
      // Mark as played immediately to prevent retries
      setHasAutoPlayed(true);

      // Small delay to ensure UI has settled
      const timer = setTimeout(async () => {
        console.log("Auto-playing audio after scan...");
        try {
          await handlePlayPause(currentNote.transcript);
        } catch (error) {
          console.log("Auto-play blocked, showing play prompt:", error);
          setShowPlayPrompt(true);
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [shouldAutoPlay, hasAutoPlayed, currentNote?.transcript]);

  useEffect(() => {
    if (note) {
      setCurrentNote(note);
      setTranscription(note.transcript);
      setHasAutoPlayed(false); // Reset auto-play flag for new note
    }
    return cleanupAudio;
  }, [note, cleanupAudio]);

  // Update transcript in currentNote when user edits
  useEffect(() => {
    if (currentNote && transcription !== currentNote.transcript) {
      const saveTimer = setTimeout(() => {
        const updatedNote = { ...currentNote, transcript: transcription };
        setCurrentNote(updatedNote);
        onSave(updatedNote);
      }, 1000); // Debounce saves
      return () => clearTimeout(saveTimer);
    }
  }, [transcription, currentNote, onSave]);

  // Close voice dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (voiceDropdownRef.current && !voiceDropdownRef.current.contains(event.target as Node)) {
        setIsVoiceDropdownOpen(false);
      }
    };
    if (isVoiceDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isVoiceDropdownOpen]);

  // Silent MP3 to unlock mobile audio
  const SILENT_MP3 = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMD//////////////////////////////////////////////////////////////////wAAAP//OEAAAAAAAAAAAAAAAAAAAAAAAATGF2YzU4LjU0AAAAAAAAAAAAAAAAAAAAAAAAAAAACCAAAAAAAAAAAAAA//OEMAAAAAAAABAAAAAAAAAAABFca5HDQAQAAAAAAAAAAAAAA//OEMAAAAAAAABAAAAAAAAAAABFca5HDQAQAAAAAAAAAAAAAA//OEMAAAAAAAABAAAAAAAAAAABFca5HDQAQAAAAAAAAAAAAAA//OEMAAAAAAAABAAAAAAAAAAABFca5HDQAQAAAAAAAAAAAAAA//OEMAAAAAAAABAAAAAAAAAAABFca5HDQAQAAAAAAAAAAAAAA";

  // Combined Play/Pause handler using HTMLAudioElement
  const handlePlayPause = async (textToPlay?: string) => {
    // If playing, pause it
    if (isPlayingAudio && !textToPlay) {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        setIsPlayingAudio(false);
      }
      return;
    }

    const text = textToPlay || currentNote?.transcript;
    if (!text) {
      showToast("There is no text to listen to.");
      setIsPlayingAudio(false);
      return;
    }

    // Reuse existing audio if available and text hasn't changed
    if (audioUrlRef.current && lastPlayedTextRef.current === text && !textToPlay) { // Force new if textToPlay passed (e.g. update)
      console.log("Reusing cached audio for text");
      if (!audioElementRef.current) {
        const audio = new Audio(audioUrlRef.current);
        audio.playbackRate = playbackSpeed;
        audioElementRef.current = audio;

        // Re-bind listeners
        audio.onended = () => setIsPlayingAudio(false);
        audio.onpause = () => setIsPlayingAudio(false);
        audio.onplay = () => setIsPlayingAudio(true);
        audio.onerror = (e) => {
          console.error("Audio playback error:", e);
          setIsPlayingAudio(false);
          showToast("Error playing audio.");
        };
      }

      try {
        await audioElementRef.current.play();
        setIsPlayingAudio(true);
      } catch (e) {
        console.error("Reuse play failed", e);
        showToast("Tap again to play"); // Direct instruction
        setIsPlayingAudio(false);
      }
      return;
    }

    // If we're here, we need to generate new audio
    console.log("Generating NEW audio for text length:", text.length);

    // Cleanup existing audio
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }

    setIsGeneratingSpeech(true);
    showToast("Generating audio...");

    // MOBILE SAFARI FIX: Initialize and play a silent file IMMEDIATELY to capture user gesture
    const audio = new Audio(SILENT_MP3);
    audio.playbackRate = playbackSpeed;
    audioElementRef.current = audio;

    // Setup listeners
    audio.onended = () => setIsPlayingAudio(false);
    audio.onpause = () => setIsPlayingAudio(false);
    audio.onplay = () => setIsPlayingAudio(true);
    audio.onerror = (e) => {
      console.error("Audio playback error:", e);
      setIsPlayingAudio(false);
    };

    try {
      // Play silence to unlock
      await audio.play();
    } catch (e) {
      console.warn("Silent unlock failed (might be auto-play), continuing...", e);
    }

    try {
      // Calculate timeout based on text length (5s base + 5s per 1000 chars, minimum 30s)
      const estimatedChunks = Math.ceil(text.length / 4000);
      const timeoutMs = Math.max(30000, 10000 + (estimatedChunks * 10000));
      console.log(`Audio generation timeout set to ${timeoutMs / 1000}s for ${estimatedChunks} chunks`);

      const fetchPromise = generateSpeechFromText(text, selectedVoice);
      const timeoutPromise = new Promise<Blob>((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out. Try with shorter text.")), timeoutMs)
      );

      const audioBlob = await Promise.race([fetchPromise, timeoutPromise]) as Blob;

      if (!audioBlob || audioBlob.size === 0) {
        throw new Error("No audio data received.");
      }

      const url = URL.createObjectURL(audioBlob);

      // Cache the new audio
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = url;
      lastPlayedTextRef.current = text;

      // Swap source to real audio
      audio.src = url;
      audio.playbackRate = playbackSpeed; // Re-apply speed

      // Play real audio
      try {
        await audio.play();
        setIsPlayingAudio(true);
      } catch (playError) {
        console.error("Playback failed (possibly autoplay blocked):", playError);
        setIsPlayingAudio(false);
        showToast("Tap Play again to listen.");
        throw playError; // Propagate error so auto-play effect can handle it
      }

    } catch (error) {
      console.error("Error generating/playing speech:", error);
      showToast("Sorry, couldn't generate audio.");
      setIsPlayingAudio(false);
      // Clean up if failed
      audio.pause();
      audioElementRef.current = null;
    } finally {
      setIsGeneratingSpeech(false);
    }
  };

  const handleStopAudio = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    setIsPlayingAudio(false);
  }, []);

  const handleSelectVoice = (voiceId: string) => {
    setSelectedVoice(voiceId);
    setIsVoiceDropdownOpen(false);
    // Force regeneration on next play
    if (audioElementRef.current) {
      handleStopAudio();
      audioElementRef.current = null;
    }
  };

  const handleChangeSpeed = () => {
    const currentIndex = playbackSpeeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % playbackSpeeds.length;
    const newSpeed = playbackSpeeds[nextIndex];
    setPlaybackSpeed(newSpeed);
    if (audioElementRef.current) {
      audioElementRef.current.playbackRate = newSpeed;
    }
  };

  // ... (rest of component) ...

  const handleStartRecording = async () => {
    if (isRecording) return;

    // Initialize/Resume audio context for playback later (iOS requires user interaction to unlock AudioContext)
    if (!outputAudioContextRef.current) {
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (outputAudioContextRef.current.state === 'suspended') {
      await outputAudioContextRef.current.resume();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Robust MIME type selection for Cross-Browser compatibility (Desktop & Mobile)
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4', // Safari / iOS often prefers this
        'audio/mp3',
        '' // Empty string allows the browser to simply use its default
      ];

      let selectedMimeType = '';
      for (const type of mimeTypes) {
        if (type === '' || MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          break;
        }
      }

      // Create MediaRecorder with the best supported option
      const options = selectedMimeType ? { mimeType: selectedMimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Start recording without timeslice to get a single large blob at the end
      // This is often more reliable on mobile Safari than chunking every second
      mediaRecorder.start();
      setIsRecording(true);
      showToast("Recording started. Speak now...");
    } catch (err) {
      console.error("Error starting recording:", err);
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        showToast("Microphone access denied. Please enable permissions in Settings.");
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        showToast("No microphone found on this device.");
      } else {
        showToast("Could not access microphone: " + (err as Error).message);
      }
      setIsRecording(false);
    }
  };

  const handleStopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    setIsRecording(false);
    const recorder = mediaRecorderRef.current;
    const stream = streamRef.current;

    // Define what to do when recording actually stops and data is available
    recorder.onstop = async () => {
      // Stop all audio tracks to release microphone
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Transcribe the recorded audio using OpenAI Whisper
      if (audioChunksRef.current.length > 0) {
        showToast("Transcribing audio...");
        try {
          // Get the actual mime type from the recorder or fallback
          const mimeType = recorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

          console.log(`Audio blob size: ${audioBlob.size} bytes, type: ${mimeType}`);

          const arrayBuffer = await audioBlob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          // Use a chunked approach for large strings to avoid stack overflow
          const CHUNK_SIZE = 8192;
          for (let i = 0; i < bytes.byteLength; i += CHUNK_SIZE) {
            const chunk = bytes.subarray(i, i + CHUNK_SIZE);
            binary += String.fromCharCode.apply(null, Array.from(chunk));
          }
          const base64Audio = btoa(binary);

          const newTranscription = await transcribeAudioFile(base64Audio, mimeType);

          // Check specifically for the error message returned by the service
          if (newTranscription.startsWith("An error occurred") || newTranscription.startsWith("Could not transcribe")) {
            showToast(newTranscription);
          } else {
            const updatedTranscript = transcription
              ? transcription + ' ' + newTranscription
              : newTranscription;

            setTranscription(updatedTranscript);

            if (currentNote) {
              const updatedNote = { ...currentNote, transcript: updatedTranscript };
              setCurrentNote(updatedNote);
              onSave(updatedNote);
            }
            showToast("Transcription complete!");
            playNotificationSound();

            // Auto-play the audio after transcription if requested
            // We need to wait a tiny bit for state to settle or just call it
            setTimeout(() => {
              handlePlayPause(updatedTranscript);
            }, 500);
          }
        } catch (error) {
          console.error("Transcription error:", error);
          showToast("Failed to transcribe audio.");
        }

        audioChunksRef.current = [];
      }

      mediaRecorderRef.current = null;
    };

    // Trigger the stop
    recorder.stop();
  }, [transcription, currentNote, onSave, showToast]);

  // Clear audio element when voice changes
  useEffect(() => {
    if (audioElementRef.current) {
      handleStopAudio();
      audioElementRef.current = null;
    }
  }, [selectedVoice]);

  const handleSummarize = async () => {
    if (!currentNote || !currentNote.transcript) return;
    setIsSummarizing(true); // Start loading state
    const summary = await summarizeTranscript(currentNote.transcript);
    const updatedNote = { ...currentNote, summary };
    setCurrentNote(updatedNote);
    onSave(updatedNote);

    // Keep isSummarizing true to show the modal with the result effectively, 
    // or toggle a separate state. For now, reusing isSummarizing for modal visibility 
    // requires us to keep it true if summary exists.
    // However, the button disables if isSummarizing is true.
    // Let's separate the states for clarity?
    // Actually, looking at the render logic:
    // {currentNote.summary && isSummarizing && ( ... Modal ... )}
    // So yes, we must keep isSummarizing = true to show the modal.
    // But we need to stop the *loading* spinner on the button.
    // The button shows spinner if `isSummarizing && !currentNote.summary`.
    // So if we have a summary and isSummarizing is true, the button shows "View Summary", which is correct.

    playNotificationSound(); // Play chime when summary is ready
    showToast("Summary ready!");
  };

  const handleExportNote = () => {
    if (!currentNote) return;
    const fileName = `${currentNote.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    const fileContent = `Title: ${currentNote.title}\n\n--- TRANSCRIPT ---\n${currentNote.transcript}\n\n--- SUMMARY ---\n${currentNote.summary || 'No summary generated.'}`;
    const blob = new window.Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleSaveToDrive = () => {
    if (driveSaveState !== 'idle' || !currentNote) return;
    setDriveSaveState('saving');
    setTimeout(() => {
      setDriveSaveState('success');
      showToast("Note saved to Google Drive (Simulated)");
      setTimeout(() => {
        setDriveSaveState('idle');
      }, 2000);
    }, 1500);
  };

  const renderDriveButtonIcon = () => {
    switch (driveSaveState) {
      case 'saving':
        return <Loader size={20} className="animate-spin text-light-text dark:text-gray-100" />;
      case 'success':
        return <Check size={20} className="text-green-500" />;
      case 'idle':
      default:
        return <UploadCloud size={20} className="text-light-text dark:text-gray-100" />;
    }
  };

  if (!currentNote) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-light-text-secondary dark:dark-text-secondary p-4">
        <FileText size={48} className="mb-4" />
        <h2 className="text-xl font-semibold">No active note</h2>
        <p>Select a note from "My Files" or start a new one.</p>
        <button onClick={onBack} className="mt-4 text-brand-blue font-semibold">Go Back</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0 mb-2 px-1">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors touch-manipulation"
            aria-label="Go back to files"
          >
            <ArrowLeft size={24} className="text-light-text dark:text-gray-100" />
          </button>
          <h2 className="text-xl font-bold text-light-text dark:text-gray-100 truncate flex-1">{currentNote.title}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportNote}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Export note as .txt file"
            >
              <Download size={20} className="text-light-text dark:text-gray-100" />
            </button>
            <button
              onClick={handleSaveToDrive}
              disabled={driveSaveState !== 'idle'}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Save note to Google Drive (simulated)"
            >
              {renderDriveButtonIcon()}
            </button>
          </div>
        </div>

        {/* Voice & Playback Controls */}
        <div className="bg-light-bg dark:bg-dark-card/50 rounded-xl p-2 flex items-center gap-1 sm:gap-2 mb-2 h-[60px] sm:h-[68px]">
          <div ref={voiceDropdownRef} className="relative flex-shrink-0">
            <button onClick={() => setIsVoiceDropdownOpen(p => !p)} className="flex items-center gap-1 text-xs sm:text-sm p-1.5 sm:p-2 rounded-lg text-brand-blue dark:text-blue-400 hover:bg-brand-blue/10 dark:hover:bg-brand-blue/20 transition-colors touch-manipulation">
              <span className="font-semibold">{selectedVoice}</span>
              <ChevronDown size={16} />
            </button>
            {isVoiceDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-light-card dark:bg-dark-card rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 z-50 animate-fade-in">
                <div className="p-2 text-sm font-semibold text-light-text dark:text-dark-text border-b border-gray-200 dark:border-slate-700">Select Voice</div>
                {voices.map(voice => (
                  <button
                    key={voice.id}
                    onClick={() => handleSelectVoice(voice.id)}
                    className="w-full text-left px-3 py-2 text-sm flex justify-between items-center text-light-text dark:text-dark-text hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span>{voice.name}</span>
                    {selectedVoice === voice.id && <Check size={16} className="text-brand-blue" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-grow h-full flex items-center justify-center mx-2 overflow-hidden">
            <AudioWaveformVisualizer analyser={analyserRef.current} isPlaying={isPlayingAudio} />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={handleChangeSpeed} className="w-12 text-sm font-bold p-2 rounded-lg text-brand-blue dark:text-blue-400 hover:bg-brand-blue/10 dark:hover:bg-brand-blue/20 transition-colors">
              {playbackSpeed}x
            </button>
            <button onClick={handleStopAudio} disabled={!audioElementRef.current} className="p-2 rounded-full text-brand-blue dark:text-blue-400 hover:bg-brand-blue/10 dark:hover:bg-brand-blue/20 transition-colors disabled:opacity-50">
              <StopCircle size={22} />
            </button>
            <button
              onClick={handlePlayPause}
              disabled={isGeneratingSpeech}
              className="w-12 h-12 flex items-center justify-center bg-brand-blue text-white rounded-full transition-transform hover:scale-105 disabled:opacity-50"
            >
              {isGeneratingSpeech
                ? <Loader size={24} className="animate-spin" />
                : isPlayingAudio
                  ? <Pause size={24} />
                  : <Play size={24} className="ml-1" />
              }
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Transcript Area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-1 pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="relative h-full">
          <textarea
            value={transcription}
            onChange={(e) => setTranscription(e.target.value)}
            readOnly={isRecording}
            placeholder="Start speaking to begin your note..."
            className="w-full h-full bg-transparent resize-none focus:outline-none text-base sm:text-lg leading-relaxed text-light-text dark:text-gray-300 placeholder-light-text-secondary dark:placeholder-dark-text-secondary overflow-y-auto p-2"
            aria-label="Note transcript"
          />
          {isRecording && <span className="absolute top-3 right-3 animate-pulse w-3 h-3 bg-red-500 rounded-full"></span>}
        </div>
      </div>

      {/* Summary Modal */}
      {currentNote.summary && isSummarizing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setIsSummarizing(false)}>
          <div className="bg-light-card dark:bg-dark-card p-6 rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-light-text dark:text-gray-100">Summary</h3>
              <button onClick={() => setIsSummarizing(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <Check size={24} />
              </button>
            </div>
            <p className="text-sm sm:text-base whitespace-pre-wrap text-light-text-secondary dark:text-gray-300 leading-relaxed">{currentNote.summary}</p>
          </div>
        </div>
      )}

      {/* Fixed Footer with Recording Button */}
      <div className="flex-shrink-0 pt-2 pb-16 sm:pb-4 bg-light-bg/80 dark:bg-dark-bg/80 backdrop-blur-sm">
        <div className="flex justify-center mb-3 sm:mb-6">
          <button
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-10 touch-manipulation"
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            <div className={`absolute inset-0 rounded-full border-2 ${isRecording ? 'border-red-500 animate-pulse' : 'border-gray-500 dark:border-white/60'}`}></div>
            <div className="w-[88%] h-[88%] bg-light-card dark:bg-[#1D1E29] rounded-full flex items-center justify-center">
              {isRecording ?
                <StopCircle size={28} className="text-red-500" /> :
                <Mic size={28} className="text-brand-blue" />
              }
            </div>
          </button>
        </div>

        {transcription && !isRecording && (
          <div className="flex gap-2 sm:gap-4 px-1">
            <button
              onClick={() => {
                if (currentNote.summary) {
                  setIsSummarizing(true); // Re-use this state to show modal if summary exists
                } else {
                  handleSummarize();
                }
              }}
              disabled={isSummarizing && !currentNote.summary}
              className="flex-1 bg-light-card dark:bg-dark-card py-3 sm:py-4 px-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 text-sm sm:text-base text-light-text dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors shadow-sm touch-manipulation"
            >
              {isSummarizing && !currentNote.summary ? <Loader size={18} className="animate-spin" /> : <FileText size={18} />}
              {currentNote.summary ? "View Summary" : "Summarize"}
            </button>
            <button
              onClick={() => onStartChat(currentNote)}
              className="flex-1 bg-brand-blue text-white py-3 sm:py-4 px-3 sm:px-4 rounded-xl font-semibold flex items-center justify-center gap-2 text-sm sm:text-base hover:opacity-90 transition-opacity shadow-md shadow-brand-blue/20 touch-manipulation"
            >
              <Send size={18} />
              Ask AI
            </button>
          </div>
        )}
      </div>

      {/* Tap to Play Prompt (for when auto-play is blocked on mobile) */}
      {showPlayPrompt && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowPlayPrompt(false);
            handlePlayPause();
          }}
        >
          <div className="bg-light-card dark:bg-dark-card rounded-2xl shadow-2xl p-8 text-center max-w-sm animate-fade-in">
            <div className="w-20 h-20 mx-auto mb-4 bg-brand-blue rounded-full flex items-center justify-center animate-pulse">
              <Play size={40} className="text-white ml-1" />
            </div>
            <h3 className="text-2xl font-bold text-light-text dark:text-dark-text mb-2">
              Ready to Listen!
            </h3>
            <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6">
              Tap anywhere to play your scanned text
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPlayPrompt(false);
                handlePlayPause();
              }}
              className="w-full bg-brand-blue text-white py-4 px-6 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity shadow-lg shadow-brand-blue/30"
            >
              Play Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotesView;

