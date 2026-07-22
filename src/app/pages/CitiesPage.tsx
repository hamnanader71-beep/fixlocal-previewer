import { SimpleCrud } from "../components/SimpleCrud";
export default function CitiesPage() {
  return <SimpleCrud title="Cities" description="Cities where you serve customers." table="cities" fields={[
    { key: "name", label: "City name", required: true },
  ]} />;
}
