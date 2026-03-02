import { DiscoveryClient } from "@/app/components/discovery-client";

export default function Page() {
  return (
    <main>
      <h1>Firearms Training Discovery</h1>
      <p>Find relevant courses by location, date, and weapon system.</p>
      <DiscoveryClient />
    </main>
  );
}