export function protectRemoteAssistanceResponse(_req, res, next) {
  res.set({
    "Cache-Control": "private, no-store, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff"
  });
  next();
}
