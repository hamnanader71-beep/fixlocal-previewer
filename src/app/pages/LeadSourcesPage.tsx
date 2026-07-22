import { SimpleCrud } from "../components/SimpleCrud";
export default function LeadSourcesPage() {
  return <SimpleCrud title="Lead Sources" description="Where your leads come from." table="lead_sources" fields={[
    { key: "name", label: "Name", required: true },
    { key: "type", label: "Type" },
  ]} />;
}
