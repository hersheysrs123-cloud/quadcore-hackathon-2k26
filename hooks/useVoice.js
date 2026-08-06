"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export function useVoice() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setTtsSupported(Boolean("speechSynthesis" in window));

      try {
        const savedAutoSpeak = localStorage.getItem("socratic_voice_auto_speak");
        if (savedAutoSpeak !== null) {
          setAutoSpeak(savedAutoSpeak === "true");
        }
      } catch (e) {
        // localStorage not available
      }
    }
  }, []);

  const toggleAutoSpeak = useCallback(() => {
    setAutoSpeak((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("socratic_voice_auto_speak", String(next));
      } catch (e) {
        // ignore
      }
      return next;
    });
  }, []);



  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setSpeakingId(null);
  }, []);

  const speak = useCallback(
    (text, id = null) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();

      if (!text) return;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = "en-US";

      utterance.onstart = () => {
        setIsSpeaking(true);
        setSpeakingId(id);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setSpeakingId(null);
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setSpeakingId(null);
      };

      window.speechSynthesis.speak(utterance);
    },
    [],
  );

  const toggleSpeak = useCallback(
    (text, id = null) => {
      if (isSpeaking && speakingId === id) {
        stopSpeaking();
      } else {
        speak(text, id);
      }
    },
    [isSpeaking, speakingId, speak, stopSpeaking],
  );

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    ttsSupported,
    isSpeaking,
    speakingId,
    autoSpeak,
    toggleAutoSpeak,
    speak,
    stopSpeaking,
    toggleSpeak,
  };
}
