export default function handler(_req: unknown, res: { status(c: number): { json(b: unknown): void } }) {
  res.status(200).json({
    message: 'Pong! Server is awake.',
    timestamp: new Date().toISOString(),
  });
}
