import { Card } from '@/components/ui/card';

export default function HomePage() {
    return (
        <Card title="Bem-vindo ao Split&Go" as="h1">
            <p className="text-muted-foreground">
                Divida despesas em grupo e quite tudo com o mínimo de transferências.
            </p>
        </Card>
    );
}
