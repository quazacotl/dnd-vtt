import {afterEach, expect, it, vi} from 'vitest'

import {createFrameAnimation} from './frameAnimation'

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})
it('ошибка кадра завершает анимацию отказом и освобождает frame', async () => {
    let callback: FrameRequestCallback = () => {}
    const cancelled: number[] = []
    vi.spyOn(performance, 'now').mockReturnValue(0)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        callback = cb
        return 17
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => cancelled.push(id))
    const animation = createFrameAnimation(100, () => {
        throw Error('draw failed')
    })
    callback(50)
    await expect(animation.finished).rejects.toThrow('draw failed')
    expect(cancelled).toContain(17)
})
it('отмена завершается без следующих кадров', async () => {
    let callback: FrameRequestCallback = () => {}
    let updates = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        callback = cb
        return 17
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const animation = createFrameAnimation(100, () => updates++)
    animation.cancel()
    callback(performance.now() + 50)
    await animation.finished
    expect(updates).toBe(0)
})
