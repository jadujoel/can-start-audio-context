declare global {
  interface Navigator {
    getAutoplayPolicy?: GetAudioPlayPolicy
  }
}

type GetAudioPlayPolicy = (type: "audiocontext") => "allowed" | "disallowed"

interface NavigatorWithAutoplayPolicy extends Navigator {
  getAutoplayPolicy: GetAudioPlayPolicy
}

function isNavigatorWithAutoPlayPolicy(navigator: Navigator): navigator is NavigatorWithAutoplayPolicy {
  return navigator.getAutoplayPolicy !== undefined
}

function contextRuns(context?: AudioContext): boolean {
  if (context !== undefined) {
    return context.state === "running"
  }
  context = new AudioContext()
  if (context.state === "running") {
    context.close().catch()
    return true
  } else {
    context.close().catch()
    return false
  }
}

function check(context?: AudioContext) {
  if (context?.state === "running") {
    return true
  }
  if (isNavigatorWithAutoPlayPolicy(navigator)) {
    return navigator.getAutoplayPolicy("audiocontext") === "allowed"
  } else if (navigator.userActivation.isActive) {
    return true
  } else if (navigator.userActivation.hasBeenActive) {
    return contextRuns()
  }
  return false
}

/**
 * Starts an audio context without console warnings.
 *
 * @example
 * import { start } from "can-start-audio-context"
 * const ctx = await start(undefined, { latencyHint: "playback", sampleRate: 48_000 })
 * console.log(ctx.state) // "running"
 */
export function start(context?: AudioContext, contextOptions?: AudioContextOptions): Promise<AudioContext | never> {
  let rejectPtr = -1
  let intervalPtr = -1
  let state: "init" | "resolved" | "rejected" = "init"
  return new Promise<AudioContext>((resolve, reject) => {
    async function done(context?: AudioContext) {
      if (state === "init") {
        state = "resolved"
        clearTimeout(rejectPtr)
        clearInterval(intervalPtr)
        const ctx = context ?? new AudioContext(contextOptions)
        return ctx.resume().then(() => resolve(ctx)).catch(console.warn)
      }
    }
    function fail(context?: AudioContext) {
      if (state === "init") {
        state = "rejected"
        clearTimeout(rejectPtr)
        clearInterval(intervalPtr)
        context?.close().catch(console.warn)
        reject(new Error("User Has Blocked Audio"))
      }
    }
    if (check(context)) {
      done(context)
      return
    }
    // we check once for this since user might have allowed autoplay
    // in "check" it only tries it if the user has already been active
    // not sure what we should do if user has intentionally blocked audio
    // i think we'll still spam the console every 200ms then
    // should test that and maybe add a counter and if user hasBeenActive
    // is true then we eventually stop the interval
    if (!isNavigatorWithAutoPlayPolicy(navigator) && contextRuns()) {
      done(context)
      return
    }
    intervalPtr = window.setInterval(() => {
      if (check()) {
        done(context)
        return
      }
      if (navigator.userActivation.hasBeenActive) {
        // don't spam the user forever if they intentionally blocked sounds
        rejectPtr = window.setTimeout(() => {
          fail(context)
        }, 4_000)
      }
    }, 200)
  })
}
