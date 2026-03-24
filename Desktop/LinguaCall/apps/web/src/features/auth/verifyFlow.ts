export async function completeVerifiedSession({
  refreshSession,
  navigate
}: {
  refreshSession: () => Promise<void>;
  navigate: (path: string) => void;
}) {
  await refreshSession();
  navigate("/session");
}
