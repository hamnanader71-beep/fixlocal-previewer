import { PageHeader } from "../components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-4xl">
      <PageHeader title="Settings" description="Workspace, security, and platform preferences." />
      <div className="grid gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Workspace</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Workspace name</Label><Input defaultValue="GetFixLocal USA" /></div>
            <div className="space-y-2"><Label>Default language</Label><Input defaultValue="English" /></div>
            <div className="space-y-2"><Label>Default currency</Label><Input defaultValue="USD" /></div>
            <div className="space-y-2"><Label>Timezone</Label><Input defaultValue="America/Chicago" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">AI & automation</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              ["Require human approval before outreach", true],
              ["Auto-stop automation after customer reply", true],
              ["Publish qualified leads to marketplace", false],
              ["Enable AI Sales Assistant", true],
            ].map(([label, val]) => (
              <div key={String(label)} className="flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <Switch defaultChecked={val as boolean} />
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="flex justify-end"><Button>Save changes</Button></div>
      </div>
    </div>
  );
}
