/**
 * Generates a randomized 6-digit server invite code with letters and numbers mixed.
 * Guaranteed to be exactly 6 characters with both uppercase alphabet and numbers.
 * Example outputs: '4VFQRW', '9K2MP8', '7X4TBN'
 */
export function generateInviteCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // Clean uppercase alphabet
  const numbers = '23456789' // Clean numbers

  // Guarantee at least 2 letters and 2 digits
  const selected: string[] = [
    letters[Math.floor(Math.random() * letters.length)],
    letters[Math.floor(Math.random() * letters.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
  ]

  const allChars = letters + numbers
  while (selected.length < 6) {
    selected.push(allChars[Math.floor(Math.random() * allChars.length)])
  }

  // Shuffle randomly using Fisher-Yates
  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[selected[i], selected[j]] = [selected[j], selected[i]]
  }

  return selected.join('')
}
