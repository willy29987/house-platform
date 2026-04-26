import { redirect } from "next/navigation";
import { isAdminAuthenticated, hasAdminCredentials } from "@/lib/admin-auth";
import { LoginForm } from "@/app/admin/login/login-form";

type AdminLoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function asText(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const authenticated = await isAdminAuthenticated();
  const params = await searchParams;
  const nextPath = asText(params.next) || "/admin";

  if (authenticated) {
    redirect(nextPath);
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md items-center px-6 py-10">
      <section className="w-full rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
        <h1 className="text-2xl font-bold text-zinc-900">內部管理後台登入</h1>
        <p className="mt-2 text-sm text-zinc-600">只有內部人員可使用後台帳號密碼登入。</p>
        {!hasAdminCredentials() ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            尚未設定後台帳密環境變數，請先設定 `.env`。
          </p>
        ) : null}
        <LoginForm nextPath={nextPath} />
      </section>
    </main>
  );
}
