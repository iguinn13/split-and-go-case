import { Card } from '@/components/ui/card';

// Placeholder landing page for signed-in users; the groups list is a separate task.
export default function GroupsPage() {
  return (
    <Card title="Seus grupos">
      <p className="text-muted">Você está conectado.</p>
    </Card>
  );
}
