import { fetchRegistrySnapshot } from "@/lib/registry";
import Dashboard from "@/components/Dashboard";

// Re-fetch every 60 seconds on the server
export const revalidate = 60;

export default async function HomePage() {
  const snapshot = await fetchRegistrySnapshot();

  return <Dashboard snapshot={snapshot} />;
}
