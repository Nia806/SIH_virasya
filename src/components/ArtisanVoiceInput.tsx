"use client";

import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Volume2, AlertCircle, RefreshCw, Languages, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export interface RegionalLanguage {
  code: string;
  bcp47: string;
  name: string;
  nativeName: string;
}

export const INDIAN_LANGUAGES: RegionalLanguage[] = [
  { code: 'hi', bcp47: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'bn', bcp47: 'bn-IN', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'mr', bcp47: 'mr-IN', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'te', bcp47: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'ta', bcp47: 'ta-IN', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'gu', bcp47: 'gu-IN', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'kn', bcp47: 'kn-IN', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', bcp47: 'ml-IN', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'pa', bcp47: 'pa-IN', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'en', bcp47: 'en-IN', name: 'English', nativeName: 'Indian English' },
];

interface ArtisanVoiceInputProps {
  transcript: string;
  onTranscriptChange: (text: string) => void;
  selectedLanguage: string;
  onLanguageChange: (langCode: string) => void;
  disabled?: boolean;
}

export function ArtisanVoiceInput({
  transcript,
  onTranscriptChange,
  selectedLanguage,
  onLanguageChange,
  disabled = false,
}: ArtisanVoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [interimText, setInterimText] = useState('');
  
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentLang = INDIAN_LANGUAGES.find(l => l.code === selectedLanguage) || INDIAN_LANGUAGES[0];

  useEffect(() => {
    // Check if browser supports Web Speech API
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = currentLang.bcp47;

      recognition.onstart = () => {
        setIsRecording(true);
        setRecordingDuration(0);
        setInterimText('');
        timerRef.current = setInterval(() => {
          setRecordingDuration(prev => prev + 1);
        }, 1000);
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let finalized = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalized += event.results[i][0].transcript + ' ';
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }

        if (finalized) {
          onTranscriptChange(
            transcript ? `${transcript.trim()} ${finalized.trim()}` : finalized.trim()
          );
        }
        setInterimText(currentInterim);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition status:', event.error);
        stopRecording();
      };

      recognition.onend = () => {
        setIsRecording(false);
        setInterimText('');
        if (timerRef.current) clearInterval(timerRef.current);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition', err);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    setIsRecording(false);
    setInterimText('');
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Language Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-secondary/20 p-3 rounded-2xl border border-border/40">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Volume2 className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">Speak About Your Craft</h4>
            <p className="text-[11px] text-muted-foreground">
              Speak naturally in your mother tongue. We transcribe & extract craft specs.
            </p>
          </div>
        </div>

        {/* Language Selection */}
        <div className="flex items-center gap-2">
          <Languages className="h-3.5 w-3.5 text-muted-foreground" />
          <Select
            value={selectedLanguage}
            onValueChange={onLanguageChange}
            disabled={isRecording || disabled}
          >
            <SelectTrigger className="h-8 text-xs rounded-xl bg-white border-border/60 min-w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INDIAN_LANGUAGES.map(lang => (
                <SelectItem key={lang.code} value={lang.code} className="text-xs">
                  <span className="font-semibold">{lang.name}</span>{' '}
                  <span className="text-muted-foreground font-sans text-[10px]">({lang.nativeName})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Recording Area & Microphone CTA */}
      <div className="flex items-center gap-3">
        {speechSupported ? (
          <Button
            type="button"
            variant={isRecording ? "destructive" : "default"}
            size="lg"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={disabled}
            className={`rounded-full px-5 h-12 gap-2 shadow-md transition-all font-semibold ${
              isRecording ? 'animate-pulse ring-4 ring-destructive/20' : ''
            }`}
          >
            {isRecording ? (
              <>
                <Square className="h-4 w-4 fill-current" />
                Stop Recording ({formatDuration(recordingDuration)})
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                Start Voice Note ({currentLang.name})
              </>
            )}
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
            <AlertCircle className="h-4 w-4" />
            <span>Voice mic is not supported in this browser. You can type notes below!</span>
          </div>
        )}

        {transcript && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onTranscriptChange('')}
            className="text-xs text-muted-foreground hover:text-foreground h-9 rounded-full"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Interim Speech Preview */}
      {isRecording && interimText && (
        <div className="text-xs italic text-primary bg-primary/5 p-2.5 rounded-xl border border-primary/20 flex items-center gap-2 animate-in fade-in">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          Listening: &ldquo;{interimText}&rdquo;
        </div>
      )}

      {/* Transcript Textarea (Artisan can edit/review or type manually) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">
            Craft Notes & Spoken Description
          </span>
          {transcript && (
            <span className="text-[11px] text-muted-foreground">
              {transcript.split(/\s+/).filter(Boolean).length} words transcribed
            </span>
          )}
        </div>
        <Textarea
          value={transcript}
          onChange={(e) => onTranscriptChange(e.target.value)}
          placeholder={`Describe your craft in ${currentLang.name} or English (e.g. materials used, craft tradition, dimensions, hours of work)...`}
          className="rounded-2xl min-h-[95px] text-sm leading-relaxed bg-white border-border/70 focus-visible:ring-primary/20"
          disabled={disabled}
        />
        <p className="text-[11px] text-muted-foreground italic">
          💡 Tip: Mention materials (e.g. clay, silk, brass), techniques (e.g. hand-spun, woodblock), or size.
        </p>
      </div>
    </div>
  );
}
