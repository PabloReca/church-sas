<script lang="ts">
  let {
    value = $bindable("" as number | string),
    placeholder = "Duración",
    name = "",
    id = "",
    required = false,
    disabled = false,
  }: {
    value?: number | string;
    placeholder?: string;
    name: string;
    id?: string;
    required?: boolean;
    disabled?: boolean;
  } = $props();

  let inputId = $derived(id || `duration-input-${Math.random().toString(36).substring(2, 11)}`);
  let displayValue = $state("");
  let secondsValue = $state(0);
  let focused = $state(false);
  let isFloating = $derived(focused || displayValue.length > 0);

  $effect(() => {
    const handleTouch = (e: TouchEvent) => {
      const input = document.getElementById(inputId);
      if (input && e.target && !input.contains(e.target as Node)) {
        input.blur();
      }
    };

    document.addEventListener('touchstart', handleTouch);
    return () => document.removeEventListener('touchstart', handleTouch);
  });

  function secondsToMMSS(seconds: number): string {
    if (!seconds && seconds !== 0) return "";

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  function mmssToSeconds(mmss: string): number {
    if (!mmss) return 0;

    const match = mmss.match(/^(\d+):(\d{1,2})$/) || mmss.match(/^(\d+)$/);

    if (match) {
      if (match.length === 2) {
        return parseInt(match[1], 10);
      } else {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);

        if (seconds < 60) {
          return minutes * 60 + seconds;
        }
      }
    }

    return 0;
  }

  function formatInput(input: string): string {
    let cleaned = input.replace(/[^\d:]/g, '');

    if ((cleaned.match(/:/g) || []).length > 1) {
      const parts = cleaned.split(':');
      cleaned = parts[0] + ':' + parts.slice(1).join('');
    }

    if (cleaned.includes(':')) {
      const [min, sec] = cleaned.split(':');
      if (sec && parseInt(sec, 10) > 59) {
        cleaned = min + ':59';
      }
    }

    return cleaned;
  }

  $effect(() => {
    if (value !== undefined && value !== "") {
      if (typeof value === 'number') {
        secondsValue = value;
        displayValue = secondsToMMSS(value);
      } else {
        const seconds = mmssToSeconds(value.toString());
        secondsValue = seconds;
        displayValue = secondsToMMSS(seconds);
      }
    } else {
      secondsValue = 0;
      displayValue = "";
    }
  });

  function handleInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const rawValue = target.value;

    if (!/^[\d:]*$/.test(rawValue)) {
      target.value = displayValue;
      return;
    }

    if (displayValue.includes(':') && rawValue.lastIndexOf(':') !== displayValue.lastIndexOf(':')) {
      target.value = displayValue;
      return;
    }

    displayValue = formatInput(rawValue);

    if (displayValue.includes(':') || /^\d+$/.test(displayValue)) {
      secondsValue = mmssToSeconds(displayValue);
    } else {
      secondsValue = 0;
    }
  }

  function handleBlur() {
    focused = false;

    if (displayValue && !displayValue.includes(':') && /^\d+$/.test(displayValue)) {
      const totalSeconds = parseInt(displayValue, 10);
      secondsValue = totalSeconds;
      displayValue = secondsToMMSS(totalSeconds);
    } else if (displayValue && displayValue.includes(':')) {
      const seconds = mmssToSeconds(displayValue);
      displayValue = secondsToMMSS(seconds);
    }
  }
</script>

<div class="relative w-full">
  <input
    id={inputId}
    type="text"
    value={displayValue}
    oninput={handleInputChange}
    onfocus={() => focused = true}
    onblur={handleBlur}
    ontouchstart={(e: TouchEvent) => setTimeout(() => (e.target as HTMLInputElement)?.focus(), 0)}
    {disabled}
    autocomplete="off"
    placeholder=" "
    class="w-full h-12 px-3 py-3 text-base border border-gray-600 rounded-md bg-transparent transition-colors focus:outline-none focus:ring-0 focus:border-white text-white"
  />

  <input
    type="hidden"
    {name}
    {required}
    value={secondsValue.toString()}
  />

  <label
    for={inputId}
    class="absolute pointer-events-none transition-all duration-200 ease-in-out
    {isFloating ? 'text-white text-xs bg-custom-dark -top-2 left-3 px-1' : 'text-gray-400 text-base left-3 top-3'}"
  >
    {placeholder}
  </label>
</div>
