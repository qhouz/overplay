import { listen } from '@tauri-apps/api/event'
import { createNotifier } from './notifications'
import { parseObsEvent } from './obs-event'

const container = document.getElementById('container')
if (!container) {
    throw new Error('Overplay notification container is missing')
}

const notify = createNotifier(container)

listen<string>('obs-event', ({ payload }) => {
    const event = parseObsEvent(payload)
    if (event) {
        notify(event)
    }
}).catch((error: unknown) => {
    console.error('Could not listen for OBS events', error)
})
