import { useState, useEffect } from "react";

export function useSettings() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  useEffect(() => {
    const savedSound = localStorage.getItem("gridshift_sound");
    if (savedSound !== null) setSoundEnabled(savedSound === "true");

    const savedVib = localStorage.getItem("gridshift_vibration");
    if (savedVib !== null) setVibrationEnabled(savedVib === "true");
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("gridshift_sound", String(next));
  };

  const toggleVibration = () => {
    const next = !vibrationEnabled;
    setVibrationEnabled(next);
    localStorage.setItem("gridshift_vibration", String(next));
  };

  return { soundEnabled, vibrationEnabled, toggleSound, toggleVibration };
}
