self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Torch & Turn', {
      body: data.body ?? "It's your turn!",
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
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
