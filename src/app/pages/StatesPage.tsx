import { SimpleCrud } from "../components/SimpleCrud";
export default function StatesPage() {
  return <SimpleCrud title="States / Provinces" description="States and provinces linked to countries." table="states" fields={[
    { key: "name", label: "Name", required: true },
    { key: "code", label: "Code" },
  ]} />;
}
