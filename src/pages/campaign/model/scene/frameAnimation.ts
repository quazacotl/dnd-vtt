/** Выполняет кадры анимации, завершая ожидание при отмене или ошибке отрисовки. */
export function createFrameAnimation(durationMs: number, update: (progress: number) => void) {
    let frame = 0
    let settled = false
    let resolve: () => void = () => {}
    let reject: (error: unknown) => void = () => {}
    const finished = new Promise<void>((res, rej) => {
        resolve = res
        reject = rej
    })
    const settle = (error?: unknown, failed = false) => {
        if (settled) return
        settled = true
        cancelAnimationFrame(frame)
        if (failed) reject(error)
        else resolve()
    }
    const start = performance.now()
    const tick = (now: number) => {
        if (settled) return
        try {
            const progress =
                durationMs <= 0 ? 1 : Math.min(1, Math.max(0, (now - start) / durationMs))
            update(progress)
            if (progress === 1) settle()
            else frame = requestAnimationFrame(tick)
        } catch (error) {
            settle(error, true)
        }
    }
    try {
        frame = requestAnimationFrame(tick)
    } catch (error) {
        settle(error, true)
    }
    return {finished, cancel: () => settle()}
}
