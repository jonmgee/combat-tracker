self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Combat Tracker', {
      body: data.body ?? "It's your turn!",
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'combat-turn',
      renotify: true,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.matchAll({ type: 'window' }).then((clientList) => {
    for (const client of clientList) {
      if ('focus' in client) return client.focus()
    }
    if (clients.openWindow) return clients.openWindow('/')
  }))
})
