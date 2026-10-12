import type {CommittedAction} from '../repository/types'

/** Последовательно проигрывает записи; отменённые ожидающие записи пропускаются. */
export function createAnimationQueue(renderer: {play(action: CommittedAction): Promise<void>}) {
    let tail = Promise.resolve()
    let generation = 0
    return {
        enqueue(action: CommittedAction) {
            const ticket = generation
            const run = tail.then(async () => {
                if (ticket === generation) await renderer.play(action)
            })
            tail = run.catch(() => {})
            return run
        },
        cancel() {
            generation++
        },
    }
}
