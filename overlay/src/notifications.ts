import { notifications } from './notification-content'
import type { NotificationGroup } from './notification-content'
import type { ObsEvent } from './obs-event'

type ActiveNotification = {
    element: HTMLDivElement
    icon: HTMLDivElement
    label: HTMLSpanElement
    description: HTMLSpanElement
    updateTimer?: number
    dismissTimer?: number
}

function createNotification(): ActiveNotification {
    const element = document.createElement('div')
    const icon = document.createElement('div')
    const text = document.createElement('div')
    const label = document.createElement('span')
    const description = document.createElement('span')

    element.className = 'toast'
    icon.setAttribute('aria-hidden', 'true')
    text.className = 'text'
    label.className = 'label'
    description.className = 'desc'
    text.append(label, description)
    element.append(icon, text)

    return { element, icon, label, description }
}

export function createNotifier(container: HTMLElement) {
    const active = new Map<NotificationGroup, ActiveNotification>()

    function dismiss(group: NotificationGroup, toast: ActiveNotification) {
        active.delete(group)
        window.clearTimeout(toast.updateTimer)
        toast.element.classList.remove('show')
        toast.element.classList.add('hide')

        const fallback = window.setTimeout(() => toast.element.remove(), 350)
        toast.element.addEventListener('transitionend', (event) => {
            if (event.target === toast.element && event.propertyName === 'opacity') {
                window.clearTimeout(fallback)
                toast.element.remove()
            }
        })
    }

    return (event: ObsEvent) => {
        const definition = notifications[event.type]
        const { group } = definition
        const existing = active.get(group)
        const toast = existing ?? createNotification()

        function render() {
            toast.element.className = 'toast group-' + definition.iconClass.slice('icon-'.length)
            toast.icon.className = 'icon-wrap ' + definition.iconClass
            toast.icon.innerHTML = definition.icon
            toast.label.textContent = definition.label
            toast.description.textContent = definition.desc(event)
        }

        if (existing) {
            window.clearTimeout(toast.updateTimer)
            window.clearTimeout(toast.dismissTimer)
            toast.element.classList.add('updating')
            toast.updateTimer = window.setTimeout(() => {
                render()
                toast.element.classList.add('show')
            }, 150)
        }
        else {
            render()
            container.append(toast.element)
            active.set(group, toast)

            // Let the browser apply the initial styles
            // before starting the entrance transition.
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (active.get(group) === toast) {
                        toast.element.classList.add('show')
                    }
                })
            })
        }

        toast.dismissTimer = window.setTimeout(() => dismiss(group, toast), definition.duration)
    }
}
