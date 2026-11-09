const eventTypes = [
    'recording_started',
    'recording_stopped',
    'replay_started',
    'replay_stopped',
    'replay_saved',
] as const

export type ObsEventType = (typeof eventTypes)[number]
export type ObsEvent = { type: ObsEventType; duration?: number }

function isEventType(value: unknown): value is ObsEventType {
    return eventTypes.some((type) => type === value)
}

export function parseObsEvent(payload: string): ObsEvent | undefined {
    if (isEventType(payload)) {
        return { type: payload }
    }

    let value: unknown
    try {
        value = JSON.parse(payload)
    } catch {
        return
    }

    if (!value || typeof value !== 'object' || !('type' in value) || !isEventType(value.type)) {
        return
    }

    const duration = 'duration' in value ? value.duration : undefined
    if (typeof duration === 'number' && Number.isFinite(duration) && duration >= 0) {
        return { type: value.type, duration }
    }

    return { type: value.type }
}
