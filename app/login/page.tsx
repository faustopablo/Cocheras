import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Ingresar — Cocheras Comafi",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-comafi-negro-verdoso p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
            C
          </div>
          <h1 className="text-2xl font-bold text-white">Cocheras Comafi</h1>
          <p className="text-sm text-white/70">Reserva de cocheras corporativas</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Iniciar sesión</CardTitle>
            <CardDescription>Usá tu cuenta corporativa @comafi.com.ar</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm redirectTo={redirectTo || "/"} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
