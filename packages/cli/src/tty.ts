/**
 * Terminal-output hygiene for capsule-controlled strings.
 *
 * A capsule's title (or any of its text) is attacker-controlled bytes that
 * verify/decode print to the operator's terminal. ANSI/OSC escape sequences
 * in it can rewrite previous lines (spoof a "VALID" verdict), retitle the
 * window, or abuse OSC-8 hyperlinks / clipboard integration. Human-facing
 * lines therefore strip every C0 control (except newline and tab), DEL, and
 * the C1 range — which removes ESC/CSI/OSC introducers entirely. Data-facing
 * output (--to json, piped markdown) stays byte-faithful.
 */

const TERMINAL_CONTROL_BYTES =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;

/** Strip terminal control bytes from a string destined for a human-facing line. */
export function stripControl(text: string): string {
  return text.replace(TERMINAL_CONTROL_BYTES, '');
}

/**
 * Sanitize content for stdout only when stdout is a TTY: an interactive
 * terminal interprets escapes, a pipe/file expects raw bytes.
 */
export function forStdout(text: string): string {
  return process.stdout.isTTY ? stripControl(text) : text;
}
