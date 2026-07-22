import { SimpleCrud } from "../components/SimpleCrud";
export default function CountriesPage() {
  return <SimpleCrud title="Countries" description="Manage countries you operate in." table="countries" fields={[
    { key: "name", label: "Name", required: true },
    { key: "code", label: "Code (e.g. US)", required: true },
  ]} />;
}
