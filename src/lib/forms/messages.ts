/**
 * Validation messages, shared by every form. Rules (they matter most for young readers):
 * - Say what to do, not what went wrong: "Enter your name", not "Name is invalid".
 * - Plain words, short sentences, no blame, no "please", no exclamation marks.
 * - Name the thing: the helpers take what the field is about ("your name", "a subject").
 * British spelling, like the rest of the product.
 */
export const messages = {
  required: (what = "an answer") => `Enter ${what}.`,
  choose: (what = "an option") => `Choose ${what}.`,
  accept: (what: string) => `Tick the box to ${what}.`,
  tooShort: (min: number) => `Use at least ${min} characters.`,
  tooLong: (max: number) => `Use ${max} characters or fewer.`,
  email: "Enter an email address like name@example.com.",
  number: "Enter a number, like 12.",
  wholeNumber: "Enter a whole number, like 12.",
  numberAtLeast: (min: number) => `Enter a number that is ${min} or more.`,
  numberAtMost: (max: number) => `Enter a number that is ${max} or less.`,
  chooseAtLeast: (min: number) => `Choose at least ${min}.`,
  chooseAtMost: (max: number) => `Choose ${max} or fewer.`,
  check: "Check this answer.",
  // Form-level messages (shown above the form).
  unreachable: "We could not reach Lumina. Check your internet connection, then try again.",
  serverProblem: "Something went wrong on our side. Try again in a moment.",
  tooManyRequests: "That was a lot of tries in a short time. Wait a minute, then try again.",
} as const;
