export const createClientId = () => {
  const date = new Date();

  const pad = (n, width = 2) => String(n).padStart(width, '0');

  const id = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`;
  return id;
};