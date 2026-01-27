<script lang="ts">
  let {
    value = $bindable<Date | null>(null),
    placeholder = "Fecha",
    name = "",
    id = "",
    required = false,
    disabled = false,
    min = undefined,
    max = undefined,
    onChange = undefined,
  }: {
    value?: Date | string | null;
    placeholder?: string;
    name: string;
    id?: string;
    required?: boolean;
    disabled?: boolean;
    min?: Date;
    max?: Date;
    onChange?: (date: Date | null) => void;
  } = $props();

  let isOpen = $state(false);
  let focused = $state(false);
  let currentMonth = $state(new Date());
  let inputValue = $state("");
  let inputId = $derived(
    id || `datepicker-${Math.random().toString(36).slice(2, 11)}`,
  );
  let view = $state("days");
  let yearDecade = $derived(Math.floor(currentMonth.getFullYear() / 12) * 12);
  let componentRef = $state<HTMLDivElement>();

  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  // Convertir string a Date si es necesario
  $effect(() => {
    if (value && typeof value === "string") {
      try {
        value = new Date(value);
      } catch (e) {
        value = null;
      }
    }
  });

  $effect(() => {
    if (value && value instanceof Date) {
      inputValue = formatDateForDisplay(value);
      currentMonth = new Date(value);
    } else {
      inputValue = "";
    }
  });

  $effect(() => {
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      if (!isOpen) return;
      const target = event.target as Element;
      if (!target.isConnected) return; // Prevent closing if element was removed from DOM (e.g. view switch)
      const container = componentRef;
      if (container && !container.contains(target)) {
        closeCalendar();
      }
    };

    document.addEventListener("click", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("click", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  });

  // Funciones de formato y parsing
  function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatDateForDisplay(date: Date): string {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  function parseDate(dateString: string): Date | null {
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateString)) {
      const [day, month, year] = dateString.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      return isNaN(date.getTime()) ? null : date;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const date = new Date(dateString + "T00:00:00");
      return isNaN(date.getTime()) ? null : date;
    }

    return null;
  }

  // Funciones de utilidad del calendario
  function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year: number, month: number): number {
    return new Date(year, month, 1).getDay();
  }

  function isDateDisabled(date: Date): boolean {
    return (min !== undefined && date < min) || (max !== undefined && date > max);
  }

  // Funciones de navegación unificadas - siguiendo patrón del Select
  function closeCalendar() {
    isOpen = false;
    view = "days";
  }

  function openCalendar() {
    if (!disabled) {
      isOpen = true;
      view = "days";

      // Scroll automático en móvil
      setTimeout(() => {
        const calendarPopup = document.getElementById("calendar-popup");
        if (calendarPopup && "ontouchstart" in window) {
          calendarPopup.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }
      }, 100);
    }
  }

  function toggleCalendar() {
    if (isOpen) {
      closeCalendar();
    } else {
      openCalendar();
    }
  }

  function navigate(direction: number) {
    if (view === "days") {
      currentMonth = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + direction,
        1
      );
    } else if (view === "months") {
      // In months view, navigation should change year
      const newYear = currentMonth.getFullYear() + direction;
      currentMonth = new Date(newYear, currentMonth.getMonth(), 1);
    } else {
      // In years view, navigation jumps by 12 years (decade view)
      const newYear = currentMonth.getFullYear() + direction * 12;
      currentMonth = new Date(newYear, currentMonth.getMonth(), 1);
    }
  }

  function selectYear(year: number) {
    currentMonth = new Date(year, currentMonth.getMonth(), 1);
    view = "months";
  }

  function selectMonth(monthIndex: number) {
    currentMonth = new Date(currentMonth.getFullYear(), monthIndex, 1);
    view = "days";
  }

  function selectDay(date: Date) {
    if (!isDateDisabled(date)) {
      value = date;
      onChange?.(date);
      closeCalendar();
    }
  }

  function showView(newView: string) {
    view = newView;
  }

  // Manejadores de eventos para móvil - manteniendo compatibilidad
  function createClickHandler(action: () => void) {
    return () => action();
  }

  function createTouchHandler(action: () => void) {
    return () => setTimeout(() => action(), 0);
  }

  // Funciones para generar arrays de datos
  function getDaysArray() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfMonth = getFirstDayOfMonth(year, month);
    const prevMonthDays = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevMonthYear = month === 0 ? year - 1 : year;
    const daysInPrevMonth = getDaysInMonth(prevMonthYear, prevMonth);
    const days = [];

    // Días del mes anterior
    for (let i = 0; i < prevMonthDays; i++) {
      const day = daysInPrevMonth - prevMonthDays + i + 1;
      const date = new Date(prevMonthYear, prevMonth, day);
      days.push({
        day,
        date,
        isCurrentMonth: false,
        isToday: date.getTime() === today.getTime(),
        isSelected: value instanceof Date ? date.getTime() === value.setHours(0, 0, 0, 0) : false,
        isDisabled: isDateDisabled(date),
      });
    }

    // Días del mes actual
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({
        day: i,
        date,
        isCurrentMonth: true,
        isToday: date.getTime() === today.getTime(),
        isSelected: value instanceof Date ? date.getTime() === value.setHours(0, 0, 0, 0) : false,
        isDisabled: isDateDisabled(date),
      });
    }

    // Días del mes siguiente para completar 42 celdas
    const totalCells = 42;
    const nextMonthDays = totalCells - days.length;
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextMonthYear = month === 11 ? year + 1 : year;

    for (let i = 1; i <= nextMonthDays; i++) {
      const date = new Date(nextMonthYear, nextMonth, i);
      days.push({
        day: i,
        date,
        isCurrentMonth: false,
        isToday: date.getTime() === today.getTime(),
        isSelected: value instanceof Date ? date.getTime() === value.setHours(0, 0, 0, 0) : false,
        isDisabled: isDateDisabled(date),
      });
    }

    return days;
  }

  function getCalendarRows() {
    const days = getDaysArray();
    const rows = [];
    for (let i = 0; i < days.length; i += 7) {
      rows.push(days.slice(i, i + 7));
    }
    return rows;
  }

  function getYearsArray() {
    const years = [];
    for (let i = 0; i < 12; i++) years.push(yearDecade + i);
    return years;
  }

  function handleInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    inputValue = target.value;
    const parsedDate = parseDate(inputValue);
    if (parsedDate) {
      value = parsedDate;
      onChange?.(parsedDate);
    } else if (inputValue === "") {
      value = null;
      onChange?.(null);
    }
  }
</script>

<div
  class="relative w-full"
  bind:this={componentRef}
  role="combobox"
  aria-label="Selector de fecha"
  aria-controls="calendar-popup"
  aria-expanded={isOpen}
>
  <div class="relative h-12 box-border">
    <input
      id={inputId}
      type="text"
      {required}
      {disabled}
      readonly
      value={inputValue}
      onclick={toggleCalendar}
      ontouchstart={toggleCalendar}
      onfocus={() => (focused = true)}
      onblur={() => (focused = false)}
      placeholder=" "
      autocomplete="off"
      class="w-full h-12 px-3 py-3 text-base border border-gray-600 rounded-md bg-transparent box-border focus:outline-none focus:ring-0 focus:border-white pr-10 cursor-pointer"
    />

    <label
      for={inputId}
      class="absolute pointer-events-none transition-all duration-200 ease-in-out text-gray-400
      {focused || inputValue || isOpen
        ? 'text-xs bg-custom-dark top-0 left-3 px-1 transform -translate-y-1/2 '
        : 'text-base left-3 top-1/2 transform -translate-y-1/2'}"
    >
      {placeholder}
    </label>

    <button
      type="button"
      onclick={toggleCalendar}
      ontouchstart={toggleCalendar}
      class="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover: transition-colors"
      {disabled}
      aria-label="Abrir calendario"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </button>
  </div>

  {#if isOpen}
    <div
      id="calendar-popup"
      class="absolute z-10 mt-1 w-full bg-custom-dark rounded-md shadow-lg border border-gray-600 p-3"
    >
      <!-- Header de navegación -->
      <div class="flex justify-between items-center mb-3">
        <button
          type="button"
          onclick={() => navigate(-1)}
          ontouchstart={() => navigate(-1)}
          class="text-gray-400 hover: p-2 rounded-full transition-colors"
          aria-label={view === "days" ? "Mes anterior" : "Década anterior"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div class="flex items-center gap-1">
          <button
            type="button"
            onclick={() => showView("months")}
            ontouchstart={() => showView("months")}
            class="font-medium px-3 py-2 rounded hover:bg-gray-700 transition-colors"
            aria-label="Mostrar selector de meses"
          >
            {monthNames[currentMonth.getMonth()]}
          </button>

          <button
            type="button"
            onclick={() => showView("years")}
            ontouchstart={() => showView("years")}
            class="font-medium px-3 py-2 rounded hover:bg-gray-700 transition-colors"
            aria-label="Mostrar selector de años"
          >
            {currentMonth.getFullYear()}
          </button>
        </div>

        <button
          type="button"
          onclick={() => navigate(1)}
          ontouchstart={() => navigate(1)}
          class="text-gray-400 hover: p-2 rounded-full transition-colors"
          aria-label={view === "days" ? "Mes siguiente" : "Década siguiente"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <!-- Vista de días -->
      {#if view === "days"}
        <div class="grid grid-cols-7 gap-1">
          <div class="contents">
            {#each dayNames as day}
              <div class="text-center text-xs min-h-8 flex items-center justify-center text-gray-400">
                {day}
              </div>
            {/each}
          </div>

          {#each getCalendarRows() as row}
            <div class="contents">
              {#each row as { day, date, isCurrentMonth, isToday, isSelected, isDisabled }}
                <button
                  type="button"
                  onclick={() => selectDay(date)}
                  ontouchend={(e) => { e.preventDefault(); selectDay(date); }}
                  disabled={isDisabled}
                  aria-label={`Seleccionar ${day} de ${monthNames[date.getMonth()]} de ${date.getFullYear()}`}
                  class="text-center min-h-8 min-w-8 flex items-center justify-center text-sm rounded-full transition-colors
                    {!isCurrentMonth && 'opacity-50'}
                    {isCurrentMonth && isToday && !isSelected && 'border border-blue-400'}
                    {isCurrentMonth && (isSelected ? 'bg-blue-600' : 'hover:bg-gray-700')}
                    {isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}"
                >
                  {day}
                </button>
              {/each}
            </div>
          {/each}
        </div>
      {/if}

      <!-- Vista de meses -->
      {#if view === "months"}
        <div class="grid grid-cols-3 gap-2 p-2">
          {#each monthNames as month, index}
            <button
              type="button"
              onclick={() => selectMonth(index)}
              ontouchend={(e) => { e.preventDefault(); selectMonth(index); }}
              aria-label={`Seleccionar mes de ${month}`}
              class="text-center py-3 text-sm rounded hover:bg-gray-700 transition-colors"
            >
              {month.substring(0, 3)}
            </button>
          {/each}
        </div>
      {/if}

      <!-- Vista de años -->
      {#if view === "years"}
        <div class="grid grid-cols-4 gap-2 p-2">
          <div class="col-span-4 text-center text-gray-400 text-sm mb-1">
            {yearDecade} - {yearDecade + 11}
          </div>
          {#each getYearsArray() as year}
            <button
              type="button"
              onclick={() => selectYear(year)}
              ontouchend={(e) => { e.preventDefault(); selectYear(year); }}
              aria-label={`Seleccionar año ${year}`}
              class="text-center py-3 text-sm rounded hover:bg-gray-700 transition-colors"
            >
              {year}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  {#if name}
    <input
      type="hidden"
      {name}
      {required}
      value={value instanceof Date ? formatDate(value) : ""}
    />
  {/if}
</div>
