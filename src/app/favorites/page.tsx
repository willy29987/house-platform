import { FavoritesList } from "@/components/favorites-list";

export const metadata = {
  title: "我的收藏 | 不動產實踐家",
  description: "查看已收藏的租屋與買屋物件",
};

export default function FavoritesPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-extrabold text-zinc-900 sm:text-3xl">我的收藏</h1>
      <p className="mt-2 text-sm text-zinc-500">收藏保留 60 天，過期將自動移除</p>
      <div className="mt-8">
        <FavoritesList />
      </div>
    </main>
  );
}
