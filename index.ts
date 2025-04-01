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
    // userActivation don't exist on ios14
  } else if (navigator.userActivation?.isActive) {
    return true
  } else if (navigator.userActivation?.hasBeenActive) {
    return contextRuns()
  }
  return false
}

// for some reason userActivation does not behave the same on ios safari
// we need to use touch listener
function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const isIOS = /iP(hone|od|ad)/.test(navigator.platform) ||
                (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform)); // iPads with iOS 13+

  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua); // Exclude Chrome, Firefox on iOS

  return isIOS && isSafari;
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
    if (isIosSafari()) {
      window.addEventListener("touchend", () => {
        done(context)
      }, { once: true })
    }

    intervalPtr = window.setInterval(() => {
      if (check()) {
        done(context)
        return
      }
    }, 200)
  })
}
