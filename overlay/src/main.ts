import { listen } from "@tauri-apps/api/event";

interface ObsEvent {
	type: string;
	duration?: number;
}

interface ToastDef {
	label: string;
	desc: (e: ObsEvent) => string;
	iconClass: string;
	icon: string;
	duration: number;
	group: "recording" | "replay";
}

const ICONS = {
	recording_started: `<svg viewBox="0 0 16 16" fill="none">
		<circle cx="8" cy="8" r="5" fill="rgba(220,60,60,0.9)"/>
	</svg>`,

	recording_stopped: `<svg viewBox="0 0 16 16" fill="none">
		<rect x="4" y="4" width="8" height="8" rx="1.5" fill="rgba(180,180,180,0.9)"/>
	</svg>`,

	replay_started: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
		<path fill="#1DA1F2" d="M236.3 107.1C247.9 96 265 92.9 279.7 99.2C294.4 105.5 304 120 304 136L304 272.3L476.3 107.2C487.9 96 505 92.9 519.7 99.2C534.4 105.5 544 120 544 136L544 504C544 520 534.4 534.5 519.7 540.8C505 547.1 487.9 544 476.3 532.9L304 367.7L304 504C304 520 294.4 534.5 279.7 540.8C265 547.1 247.9 544 236.3 532.9L44.3 348.9C36.5 341.3 32 330.9 32 320C32 309.1 36.5 298.7 44.3 291.1L236.3 107.1z" />
	</svg>`,

	replay_stopped: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
		<path fill="#9CA3AF" d="M236.3 107.1C247.9 96 265 92.9 279.7 99.2C294.4 105.5 304 120 304 136L304 272.3L476.3 107.2C487.9 96 505 92.9 519.7 99.2C534.4 105.5 544 120 544 136L544 504C544 520 534.4 534.5 519.7 540.8C505 547.1 487.9 544 476.3 532.9L304 367.7L304 504C304 520 294.4 534.5 279.7 540.8C265 547.1 247.9 544 236.3 532.9L44.3 348.9C36.5 341.3 32 330.9 32 320C32 309.1 36.5 298.7 44.3 291.1L236.3 107.1z" />
	</svg>`,

	replay_saved: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
		<path fill="#F2F2F2" d="M128 96C92.7 96 64 124.7 64 160L64 480C64 515.3 92.7 544 128 544L289.4 544C280.1 523.7 274.2 501.5 272.5 478.1C244.6 471.2 224 446 224 416C224 380.7 252.7 352 288 352C294.3 352 300.4 352.9 306.2 354.6C340.9 304.7 398.6 272 464 272C480.6 272 496.7 274.1 512 278L512 237.2C512 220.2 505.3 203.9 493.3 191.9L416 114.7C404 102.7 387.7 96 370.7 96L128 96zM160 192C160 174.3 174.3 160 192 160L352 160C369.7 160 384 174.3 384 192L384 256C384 273.7 369.7 288 352 288L192 288C174.3 288 160 273.7 160 256L160 192zM608 464C608 384.5 543.5 320 464 320C384.5 320 320 384.5 320 464C320 543.5 384.5 608 464 608C543.5 608 608 543.5 608 464zM460.7 396.7C466.9 390.5 477.1 390.5 483.3 396.7L539.3 452.7C545.5 458.9 545.5 469.1 539.3 475.3L483.3 531.3C477.1 537.5 466.9 537.5 460.7 531.3C454.5 525.1 454.5 514.9 460.7 508.7L489.4 480L400 480C391.2 480 384 472.8 384 464C384 455.2 391.2 448 400 448L489.4 448L460.7 419.3C454.5 413.1 454.5 402.9 460.7 396.7z" />
	</svg>`,
};

const EVENTS: Record<string, ToastDef> = {
	recording_started: {
		label: "Recording",
		desc: () => "Was started",
		iconClass: "icon-rec-start",
		icon: ICONS.recording_started,
		duration: 3000,
		group: "recording",
	},

	recording_stopped: {
		label: "Recording",
		desc: (e) =>
			e.duration != null ? `Was stopped ${formatDuration(e.duration)}` : "Was stopped",
		iconClass: "icon-rec-stop",
		icon: ICONS.recording_stopped,
		duration: 3000,
		group: "recording",
	},

	replay_started: {
		label: "Instant Replay",
		desc: () => "Was started",
		iconClass: "icon-rp-start",
		icon: ICONS.replay_started,
		duration: 3000,
		group: "replay",
	},

	replay_stopped: {
		label: "Instant Replay",
		desc: () => "Was stopped",
		iconClass: "icon-rp-stop",
		icon: ICONS.replay_stopped,
		duration: 3000,
		group: "replay",
	},

	replay_saved: {
		label: "Instant Replay",
		desc: (e) =>
			e.duration != null ? `Saved clip ${formatDuration(e.duration)}` : "Clip saved",
		iconClass: "icon-rp-saved",
		icon: ICONS.replay_saved,
		duration: 4000,
		group: "replay",
	},
};

function formatDuration(seconds: number): string {
	const s = Math.round(seconds);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	const rem = s % 60;
	return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

const activeToasts = new Map<string, {
	el: HTMLElement;
	dismissTimer: ReturnType<typeof setTimeout>;
}>();

function showToast(event: ObsEvent): void {
	const def = EVENTS[event.type];
	if (!def) return;

	const container = document.getElementById("container")!;
	const existing = activeToasts.get(def.group);

	if (existing) {
		clearTimeout(existing.dismissTimer);

		const iconWrap = existing.el.querySelector(".icon-wrap")!;
		const label = existing.el.querySelector(".label")!;
		const desc = existing.el.querySelector(".desc")!;

		existing.el.classList.add("updating");
		setTimeout(() => {
			existing.el.className = `toast show group-${def.iconClass.replace('icon-', '')}`;
			iconWrap.className = `icon-wrap ${def.iconClass}`;
			iconWrap.innerHTML = def.icon;
			label.textContent = def.label;
			desc.textContent = def.desc(event);
			existing.el.classList.remove("updating");
		}, 150);

		const dismissTimer = setTimeout(() => dismissToast(def.group), def.duration);
		activeToasts.set(def.group, { el: existing.el, dismissTimer });
	}
	else {
		const toast = document.createElement("div");
		toast.className = `toast group-${def.iconClass.replace('icon-', '')}`;

		toast.innerHTML = `
			<div class="icon-wrap ${def.iconClass}">${def.icon}</div>
			<div class="text">
				<span class="label">${def.label}</span>
				<span class="desc">${def.desc(event)}</span>
			</div>
		`;

		container.appendChild(toast);

		requestAnimationFrame(() => {
			requestAnimationFrame(() => toast.classList.add("show"));
		});

		const dismissTimer = setTimeout(() => dismissToast(def.group), def.duration);
		activeToasts.set(def.group, { el: toast, dismissTimer });
	}
}

function dismissToast(group: string): void {
	const entry = activeToasts.get(group);
	if (!entry) return;

	entry.el.classList.remove("show");
	entry.el.classList.add("hide");

	entry.el.addEventListener("transitionend", () => {
		entry.el.remove();
	}, { once: true });

	activeToasts.delete(group);
}

async function init() {
    await listen<string>("obs-event", (event) => {
        try {
            const parsed: ObsEvent = JSON.parse(event.payload);
            showToast(parsed);
        } catch {
            showToast({ type: event.payload });
        }
    });
}

init();