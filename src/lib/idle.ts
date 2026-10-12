// Fila de tarefas leves que rodam quando o navegador está ocioso, uma por vez.
// Usada para desenhar os rótulos em canvas sem travar a rolagem nem as animações.

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
}

export function idle(timeout = 400): Promise<void> {
  return new Promise((resolve) => {
    const w = window as IdleWindow
    if (w.requestIdleCallback) w.requestIdleCallback(() => resolve(), { timeout })
    else setTimeout(resolve, 24)
  })
}

const queue: (() => void)[] = []
let running = false

async function pump() {
  running = true
  while (queue.length) {
    await idle()
    queue.shift()?.()
  }
  running = false
}

export function scheduleIdle(task: () => void) {
  queue.push(task)
  if (!running) void pump()
}
