/**
 * Jest global setup — runs before every test file.
 * Intercepts process.stderr.write directly to suppress NestJS Logger output.
 * Those [Nest] ERROR lines come from intentional error-handling tests and are
 * expected behaviour — they should not pollute the test runner output.
 */
const originalWrite = process.stderr.write.bind(process.stderr);

process.stderr.write = (chunk, encoding, callback) => {
  const text = typeof chunk === 'string' ? chunk : chunk.toString();

  // Drop any line that contains the NestJS log prefix [Nest]
  if (text.includes('[Nest]')) {
    if (typeof encoding === 'function') encoding();
    else if (typeof callback === 'function') callback();
    return true;
  }

  return originalWrite(chunk, encoding, callback);
};
