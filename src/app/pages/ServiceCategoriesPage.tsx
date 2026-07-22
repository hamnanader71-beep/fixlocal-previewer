import { SimpleCrud } from "../components/SimpleCrud";
export default function ServiceCategoriesPage() {
  return <SimpleCrud title="Service Categories" description="Types of services your platform supports." table="service_categories" fields={[
    { key: "name", label: "Name", required: true },
    { key: "slug", label: "Slug (auto)" },
    { key: "description", label: "Description" },
  ]} />;
}
