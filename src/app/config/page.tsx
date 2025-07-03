
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/lib/db";
import { ConfigTabs } from "@/components/config/config-tabs";

export default async function ConfigPage() {
  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      include: {
        roles: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.role.findMany({
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Manage application-wide settings, users, and roles from this central hub.
          </CardDescription>
        </CardHeader>
      </Card>
      <ConfigTabs
        users={JSON.parse(JSON.stringify(users))}
        roles={JSON.parse(JSON.stringify(roles))}
      />
    </div>
  );
}
