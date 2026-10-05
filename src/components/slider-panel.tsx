import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  CHANNELS,
  channelGradient,
  channelMax,
  formatChannel,
  getChannel,
  setChannel,
  type Channel,
  type Color,
  type ColorMode,
} from "@/lib/color-engine";

const COLOR_MODES: readonly { value: ColorMode; label: string }[] = [
  { value: "oklch", label: "OKLCH" },
  { value: "hsb", label: "HSB" },
  { value: "rgb", label: "RGB" },
];

const READOUT_FADE_DELAY = 1000;

type SliderPanelProps = {
  color: Color;
  colorMode: ColorMode;
  onColorChange: (color: Color) => void;
  onColorModeChange: (mode: ColorMode) => void;
};

// Colour mode tabs, channel readout and three sliders for the active colour (CONTEXT.md: Slider panel).
export function SliderPanel({ color, colorMode, onColorChange, onColorModeChange }: SliderPanelProps) {
  // The readout shows the channel hovered, focused or last touched, and fades ~1s after release
  // or once the pointer leaves (so you can see what a slider is before changing it; user).
  const [readoutChannel, setReadoutChannel] = useState<Channel | null>(null);
  const [readoutVisible, setReadoutVisible] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(fadeTimer.current), []);

  function handleShow(channel: Channel) {
    clearTimeout(fadeTimer.current);
    setReadoutChannel(channel);
    setReadoutVisible(true);
  }

  function handleChange(channel: Channel, value: number) {
    handleShow(channel);
    onColorChange(setChannel(color, colorMode, channel, value));
  }

  function handleRelease() {
    clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => setReadoutVisible(false), READOUT_FADE_DELAY);
  }

  // The readout only makes sense for the mode it was touched in.
  const readout = readoutChannel && CHANNELS[colorMode].includes(readoutChannel) ? readoutChannel : null;

  return (
    <section className="flex shrink-0 flex-col gap-4 border-t border-border bg-canvas p-4">
      <div className="flex items-center justify-between">
        <div role="group" aria-label="Colour mode" className="flex items-center gap-1">
          {COLOR_MODES.map((mode) => (
            <Button
              key={mode.value}
              selected={mode.value === colorMode}
              aria-pressed={mode.value === colorMode}
              onClick={() => onColorModeChange(mode.value)}
            >
              {mode.label}
            </Button>
          ))}
        </div>
        <p
          aria-hidden
          className={`tracking-[0.04em] transition-opacity ${readout && readoutVisible ? "opacity-100" : "opacity-0"}`}
        >
          {readout && (
            <>
              {readout.label} <span className="text-value">{formatChannel(getChannel(color, colorMode, readout), readout)}</span>
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {CHANNELS[colorMode].map((channel) => (
          <Slider
            key={`${colorMode}-${channel.key}`}
            label={channel.label}
            value={getChannel(color, colorMode, channel)}
            max={channelMax(color, colorMode, channel)}
            step={channel.step}
            gradient={channelGradient(color, colorMode, channel)}
            onChange={(value) => handleChange(channel, value)}
            onShow={() => handleShow(channel)}
            onRelease={handleRelease}
          />
        ))}
      </div>
    </section>
  );
}
