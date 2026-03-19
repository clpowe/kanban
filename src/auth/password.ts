const encoder = new TextEncoder()
const HASH_ALGORITHM = 'PBKDF2'
const DIGEST = 'SHA-256'
const ITERATIONS = 100_000
const KEY_LENGTH_BITS = 256
const SALT_BYTES = 16

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function deriveHash(password: string, salt: Uint8Array, iterations: number) {
  const normalizedSalt = Uint8Array.from(salt)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    HASH_ALGORITHM,
    false,
    ['deriveBits']
  )

  const bits = await crypto.subtle.deriveBits(
    {
      name: HASH_ALGORITHM,
      hash: DIGEST,
      salt: normalizedSalt,
      iterations,
    },
    keyMaterial,
    KEY_LENGTH_BITS
  )

  return new Uint8Array(bits)
}

function constantTimeEquals(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false
  }

  let diff = 0

  for (let index = 0; index < left.length; index++) {
    diff |= left[index]! ^ right[index]!
  }

  return diff === 0
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await deriveHash(password, salt, ITERATIONS)

  return `pbkdf2$${ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`
}

export async function verifyPassword(
  password: string,
  encodedHash: string
): Promise<boolean> {
  const [algorithm, iterationText, saltText, hashText] = encodedHash.split('$')

  if (
    algorithm !== 'pbkdf2' ||
    !iterationText ||
    !saltText ||
    !hashText
  ) {
    return false
  }

  const iterations = Number(iterationText)

  if (!Number.isInteger(iterations) || iterations <= 0) {
    return false
  }

  const salt = base64ToBytes(saltText)
  const expectedHash = base64ToBytes(hashText)
  const actualHash = await deriveHash(password, salt, iterations)

  return constantTimeEquals(actualHash, expectedHash)
}
