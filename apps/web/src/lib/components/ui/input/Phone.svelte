<script lang="ts">
	import { clickOutsideAction } from "svelte-tel-input/utils";
	import { TelInput, isSelected, normalizedCountries } from "svelte-tel-input";
	import type {
		DetailedValue,
		CountryCode,
		E164Number,
		TelInputOptions,
		Country,
	} from "svelte-tel-input/types";
	import "svelte-tel-input/styles/flags.css";
	import { onMount } from "svelte";

	let {
		clickOutside = true,
		closeOnClick = true,
		disabled = false,
		detailedValue = $bindable<DetailedValue | null>(null),
		value = $bindable<E164Number | null>(null),
		searchPlaceholder = "Buscar país...",
		selectedCountry = $bindable<CountryCode | null>("ES"),
		valid = $bindable(false),
		options = { format: "national" },
		name = "phone",
		error = undefined,
		onchange = undefined,
		onsame = undefined,
	}: {
		clickOutside?: boolean;
		closeOnClick?: boolean;
		disabled?: boolean;
		detailedValue?: DetailedValue | null;
		value?: E164Number | null;
		searchPlaceholder?: string | null;
		selectedCountry?: CountryCode | null;
		valid?: boolean;
		options?: TelInputOptions;
		name?: string;
		error?: string | undefined;
		onchange?: ((event: { option: CountryCode }) => void) | undefined;
		onsame?: ((event: { option: CountryCode }) => void) | undefined;
	} = $props();

	let searchText = $state("");
	let isOpen = $state(false);
	let searchInput = $state<HTMLInputElement>();
	let isFocused = $state(false);
	let componentElement = $state<HTMLElement>();

	let selectedCountryDialCode = $derived(
		String(normalizedCountries.find((el) => el.iso2 === selectedCountry)?.dialCode || "")
	);

	let handleBlur = () => {
		setTimeout(() => {
			if (!document.activeElement?.closest(".telephone-component")) {
				isFocused = false;
			}
		}, 10);
	};

	// Actualizar inputs hidden directamente
	$effect(() => {
		const form = componentElement?.closest("form");
		if (!form) return;

		const phoneInput = form.querySelector(`input[name="${name}"]`) as HTMLInputElement;
		const countryInput = form.querySelector(`input[name="${name}_country"]`) as HTMLInputElement;
		const validInput = form.querySelector(`input[name="${name}_valid"]`) as HTMLInputElement;

		const phoneValue = value || "";
		const isValidPhone = valid && phoneValue.length > 0;

		if (phoneInput) phoneInput.value = phoneValue;
		if (countryInput) countryInput.value = selectedCountry || "";
		if (validInput) validInput.value = isValidPhone ? "true" : "false";
	});

	$effect(() => {
		const handleOutside = (e: Event) => {
			if ((isOpen || isFocused) && e.target && !componentElement?.contains(e.target as Node)) {
				if (isOpen) closeDropdown();
				if (isFocused) isFocused = false;
			}
		};

		document.addEventListener('click', handleOutside);
		document.addEventListener('touchstart', handleOutside);
		return () => {
			document.removeEventListener('click', handleOutside);
			document.removeEventListener('touchstart', handleOutside);
		};
	});

	onMount(() => {
		const form = componentElement?.closest("form");
		if (!form) return;

		[name, `${name}_country`, `${name}_valid`].forEach((inputName, i) => {
			if (!form.querySelector(`input[name="${inputName}"]`)) {
				const input = document.createElement("input");
				input.type = "hidden";
				input.name = inputName;
				input.value = [value || "", selectedCountry || "", valid ? "true" : "false"][i];
				form.appendChild(input);

			}
		});
	});

	function toggleDropDown() {
		if (disabled) return;
		isOpen = !isOpen;
		if (isOpen) {
			isFocused = true;
			setTimeout(() => searchInput?.focus(), 0);

			setTimeout(() => {
				const dropdown = document.getElementById("dropdown-countries");
				if (dropdown && "ontouchstart" in window) {
					dropdown.scrollIntoView({ behavior: "smooth", block: "nearest" });
				}
			}, 100);
		}
	}

	function closeDropdown() {
		isOpen = false;
		searchText = "";
		handleBlur();
	}

	function handleSelect(val: CountryCode) {
		setTimeout(() => {
			if (selectedCountry !== val) {
				selectedCountry = val;
				onchange?.({ option: val });
			} else {
				onsame?.({ option: val });
			}
			if (closeOnClick) closeDropdown();
		}, 0);
	}

	function handleTelInputTouch(e: TouchEvent) {
		e.preventDefault();
		if (isOpen) closeDropdown();

		const targetInput = componentElement?.querySelector('input[type="tel"]') as HTMLInputElement;
		if (targetInput) {
			targetInput.focus();
			targetInput.click();
		}
	}

	function sortCountries(countries: Country[], text: string) {
		const normalizedText = text.trim().toLowerCase();
		if (!normalizedText) return countries.sort((a, b) => a.label.localeCompare(b.label));

		return countries.sort((a, b) => {
			const aName = a.name.toLowerCase();
			const bName = b.name.toLowerCase();
			const aStarts = aName.startsWith(normalizedText);
			const bStarts = bName.startsWith(normalizedText);

			if (aStarts !== bStarts) return aStarts ? -1 : 1;

			const aIndex = aName.indexOf(normalizedText);
			const bIndex = bName.indexOf(normalizedText);

			if (aIndex === -1 && bIndex === -1) return a.id.localeCompare(b.id);
			if (aIndex === -1) return 1;
			if (bIndex === -1) return -1;

			return aIndex - bIndex;
		});
	}
</script>

<div
	bind:this={componentElement}
	class="flex relative rounded-lg telephone-component border border-gray-600 transition-colors w-full {isFocused ? 'ring-0.5 ring-white border-white' : ''}"
>
	<div class="flex" use:clickOutsideAction={() => clickOutside && closeDropdown()}>
		<button
			class="relative shrink-0 overflow-hidden z-10 whitespace-nowrap inline-flex items-center py-2.5 px-4 font-medium text-center text-gray-300 bg-custom-dark border-0 rounded-l-lg hover:bg-[#1f1e25] focus:outline-none transition-colors border-r border-gray-600 cursor-pointer"
			type="button"
			role="combobox"
			aria-controls="dropdown-countries"
			aria-expanded={isOpen}
			aria-haspopup="listbox"
			onclick={toggleDropDown}
			ontouchend={(e) => { e.preventDefault(); toggleDropDown(); }}
			onkeydown={(e) => {
				if (disabled) return;
				if (!isOpen && e.key.length === 1) {
					isOpen = true;
					searchText = e.key;
					setTimeout(() => searchInput?.focus(), 0);
				}
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					toggleDropDown();
				}
				if (e.key === "Escape") closeDropdown();
			}}
			onfocus={() => isFocused = true}
			onblur={handleBlur}
			style="-webkit-touch-callout: none; -webkit-user-select: none;"
		>
			{#if selectedCountry}
				<div class="inline-flex items-center text-left">
					<span class="flag flag-{selectedCountry.toLowerCase()} shrink-0 mr-3"></span>
					<span class="text-gray-300">+{selectedCountryDialCode}</span>
				</div>
			{:else}
				Selecciona un país
			{/if}
			<svg
				class="ml-1 w-4 h-4 transition-transform {isOpen ? 'rotate-180' : ''}"
				fill="currentColor"
				viewBox="0 0 20 20"
			>
				<path
					fill-rule="evenodd"
					d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
					clip-rule="evenodd"
				/>
			</svg>
		</button>

		{#if isOpen}
			<div id="dropdown-countries" class="absolute z-10 w-full bg-custom-dark border border-gray-600 rounded-md shadow-lg overflow-hidden translate-y-11">
				<div class="sticky top-0 bg-custom-dark border-b border-gray-600">
					<input
						bind:this={searchInput}
						type="text"
						class="px-4 py-2 focus:outline-none w-full bg-custom-dark placeholder-gray-400"
						bind:value={searchText}
						placeholder={searchPlaceholder}
						onfocus={() => isFocused = true}
						onblur={handleBlur}
					/>
				</div>

				<div class="max-h-48 overflow-y-auto countries-scroll">
					{#each sortCountries(normalizedCountries, searchText) as country (country.id)}
						{@const isActive = isSelected(country.iso2, selectedCountry)}
						<button
							type="button"
							class="inline-flex py-2 px-4 w-full hover:bg-gray-700 transition-colors cursor-pointer {isActive ? 'bg-gray-800' : 'text-gray-300 hover:text-white'}"
							onclick={() => handleSelect(country.iso2)}
							ontouchend={(e) => { e.preventDefault(); handleSelect(country.iso2); }}
							style="-webkit-touch-callout: none; -webkit-user-select: none;"
						>
							<span class="flag flag-{country.iso2.toLowerCase()} shrink-0 mr-3"></span>
							<span class="mr-2 flex-1 truncate text-left">{country.name}</span>
							<span class="text-gray-400 shrink-0">+{country.dialCode}</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<TelInput
		bind:country={selectedCountry}
		bind:detailedValue
		bind:value
		bind:valid
		{options}
		class="rounded-r-lg block w-full p-2.5 focus:outline-none border-0 bg-custom-dark placeholder-gray-400 transition-colors"
		style="-webkit-touch-callout: none; -webkit-user-select: none; cursor: text;"
		onfocus={() => {
			isFocused = true;
			if (isOpen) closeDropdown();
		}}
		onblur={handleBlur}
		ontouchend={handleTelInputTouch}
	/>
</div>

<style>
	.countries-scroll::-webkit-scrollbar {
		width: 6px;
	}
	.countries-scroll::-webkit-scrollbar-track {
		background: transparent;
	}
	.countries-scroll::-webkit-scrollbar-thumb {
		background: #6b7280;
		border-radius: 3px;
	}
	.countries-scroll::-webkit-scrollbar-thumb:hover {
		background: #9ca3af;
	}
</style>
