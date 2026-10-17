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
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-white/20 sm:p-8">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0b2545] text-xl font-bold text-white">
          實
        </div>
        <h1 className="text-2xl font-bold text-zinc-900">內部管理後台</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          登入後可管理物件、檢視資料與帳號設定。
        </p>
        {!hasAdminCredentials() ? (
          <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            尚未設定後台帳密環境變數，請先設定 `.env`。
          </p>
        ) : null}
        <LoginForm nextPath={nextPath} />
      </section>
    </div>
  );
}
