/**
 * Shared error handling: users see a short, plain-language message while the
 * real error (message + stack) goes to the server logs.
 */

/** Throw this when the message is written for the person using the app. */
export class UserFacingError extends Error {
  readonly userFacing = true;
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

const INTERNAL_MARKERS = [
  "__",
  "Cannot destructure",
  "is not a function",
  "is not defined",
  "undefined is not",
  "Unexpected token",
  "TypeError",
  "ReferenceError",
  "SyntaxError",
  "at /",
  "node_modules",
  "\n",
];

/** Heuristic: is this message safe (and useful) to show to a person? */
export function isUserFacingMessage(message: string): boolean {
  const text = message.trim();
  if (!text || text.length > 200) return false;
  return !INTERNAL_MARKERS.some((marker) => text.includes(marker));
}

function fallbackMessage(action: string): string {
  return `Something went wrong while ${action}. The team has been notified — please try again in a moment.`;
}

/**
 * Wraps a server-function handler. Logs the full error with an action tag and
 * re-throws a message that is safe to show in a toast.
 *
 * @param tag       machine-readable action tag, e.g. "estimate.send"
 * @param action    human phrase used in the fallback message, e.g. "sending the estimate"
 */
export function guarded<Args extends unknown[], Result>(
  tag: string,
  action: string,
  handler: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      // Redirects/Responses thrown by the framework must bubble untouched.
      if (error instanceof Response || (error as { isRedirect?: boolean })?.isRedirect) throw error;

      const raw = error instanceof Error ? error : new Error(String(error));
      console.error(`[${tag}]`, raw.message, raw.stack ?? "");

      if (raw instanceof UserFacingError) throw new Error(raw.message);
      if (isUserFacingMessage(raw.message)) throw new Error(raw.message);
      throw new Error(fallbackMessage(action));
    }
  };
}
